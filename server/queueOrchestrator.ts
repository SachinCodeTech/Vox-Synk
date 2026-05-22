import { 
  SyncJobRecord, 
  getSyncJobs, 
  updateSyncJobProgress, 
  insertLog, 
  addDeviceStorage,
  getDevices,
  updateDeviceStatus
} from './db.js';

const CONCURRENCY_LIMIT = 2;

// Keep track of internal task execution parameters
interface TaskExecutionState {
  chunkIndex: number;
  totalChunks: number;
  retryAttempts: number;
  interruptedProgress?: number;
  isCancelled?: boolean;
}

const activeTasksState = new Map<string, TaskExecutionState>();

// Helper to convert size string (e.g., "14.2 MB", "1.4 GB") to MBs
function parseSizeToMB(sizeStr: string): number {
  const clean = sizeStr.toLowerCase().trim();
  const val = parseFloat(clean) || 0;
  if (clean.includes('gb')) return val * 1024;
  if (clean.includes('kb')) return val / 1024;
  return val;
}

// Tick the queue one step
export async function tickSyncQueue(wanLimitMBs: number): Promise<void> {
  try {
    const jobs = await getSyncJobs();
    
    // Filter active running tasks and candidate queued tasks
    const activeJobs = jobs.filter(j => 
      j.status === 'SYNCING' || 
      j.status === 'VERIFYING' || 
      j.status === 'TRANSFERRING' || 
      j.status === 'VALIDATING'
    );
    
    const queuedJobs = jobs.filter(j => j.status === 'QUEUED');
    
    // Sort queued jobs by file size (smallest task prioritized first for cluster flow)
    queuedJobs.sort((a, b) => parseSizeToMB(a.fileName) - parseSizeToMB(b.fileName));
    
    const nowTime = new Date().toLocaleTimeString().split(' ')[0];

    // Promote QUEUED jobs up to the concurrency limit
    while (activeJobs.length < CONCURRENCY_LIMIT && queuedJobs.length > 0) {
      const nextJob = queuedJobs.shift()!;
      
      // Initialize internal execution parameters for this task
      const fileMB = parseSizeToMB(nextJob.size);
      const totalChunks = Math.max(5, Math.min(20, Math.ceil(fileMB / 10))); // 10MB chunks
      
      activeTasksState.set(nextJob.id, {
        chunkIndex: 0,
        totalChunks,
        retryAttempts: 0
      });
      
      // Upgrade status to VERIFYING (Stage 3 lifecycle requirement!)
      nextJob.status = 'VERIFYING' as any;
      nextJob.progress = 5;
      nextJob.eta = 'Verifying...';
      nextJob.speed = '0.0 MB/s';
      activeJobs.push(nextJob);
      
      await insertLog({
        id: `log-state-verifying-${Date.now()}-${nextJob.id}`,
        timestamp: nowTime,
        level: 'INFO',
        deviceId: nextJob.sourceDevice,
        message: `[Sync Engine] Initiating secure multi-node verification on "${nextJob.fileName}". Negotiating protocol handshakes and computing preliminary local block hashes...`
      });
      
      await updateSyncJobProgress(nextJob.id, 5, '0.0 MB/s', 'VERIFYING' as any, 'Verifying...');
    }

    // Process advancing states for all active jobs
    for (const job of activeJobs) {
      const tState = activeTasksState.get(job.id) || { chunkIndex: 0, totalChunks: 10, retryAttempts: 0 };
      
      if (tState.isCancelled) {
        await updateSyncJobProgress(job.id, job.progress, '0.0 MB/s', 'FAILED', 'Cancelled');
        await insertLog({
          id: `log-cancelled-${Date.now()}-${job.id}`,
          timestamp: nowTime,
          level: 'WARNING',
          deviceId: job.sourceDevice,
          message: `❌ [Sync Engine] Replication session for "${job.fileName}" was cancelled by administrative operator policy.`
        });
        activeTasksState.delete(job.id);
        continue;
      }

      const fileMB = parseSizeToMB(job.size);
      const currentStatus = job.status as string;

      if (currentStatus === 'VERIFYING') {
        // Validation of block hashes passes -> promote to TRANSFERRING
        job.status = 'TRANSFERRING' as any;
        job.progress = 10;
        job.eta = 'Connecting...';
        
        await insertLog({
          id: `log-state-transferring-${Date.now()}-${job.id}`,
          timestamp: nowTime,
          level: 'SUCCESS',
          deviceId: job.sourceDevice,
          message: `🔐 [Sync Protocol] Integrity verified (SHA-256 match). Peer tunnel established NYC <-> LDN on port 3001. Initiating parallel chunk stream (${tState.totalChunks} shards)...`
        });
        
        await updateSyncJobProgress(job.id, 10, '0.0 MB/s', 'TRANSFERRING' as any, 'Calculating...');
        continue;
      }

      if (currentStatus === 'TRANSFERRING') {
        // Check for simulated chunk corruption retry (approx 3% probability per tick to keep it authentic)
        const isTransientGlitch = Math.random() < 0.03 && job.progress > 20 && job.progress < 80;
        
        if (isTransientGlitch) {
          tState.retryAttempts++;
          if (tState.retryAttempts <= 3) {
            // Partial chunk retry - rollback progress slightly
            const newProgress = Math.max(10, job.progress - 15);
            tState.chunkIndex = Math.max(0, tState.chunkIndex - 1);
            
            await insertLog({
              id: `log-tr-retry-${Date.now()}-${job.id}`,
              timestamp: nowTime,
              level: 'WARNING',
              deviceId: job.sourceDevice,
              message: `⚠️ [Sync Engine] Cryptographic mismatch on file fragment chunk ${tState.chunkIndex} of ${tState.totalChunks} on "${job.fileName}". triggering automatic parallel retry (Attempt ${tState.retryAttempts}/3).`
            });
            
            await updateSyncJobProgress(job.id, newProgress, '1.4 MB/s', 'TRANSFERRING' as any, 'Retrying...');
          } else {
            // Permanently fail
            await updateSyncJobProgress(job.id, job.progress, '0.0 MB/s', 'FAILED', 'Error');
            await insertLog({
              id: `log-fatal-${Date.now()}-${job.id}`,
              timestamp: nowTime,
              level: 'ALERT',
              deviceId: 'CLUSTER-SCHEDULER',
              message: `❌ [Sync Queue Fatal] Bandwidth drop. Transmission of "${job.fileName}" failed permanently after three consecutive block retries.`
            });
            activeTasksState.delete(job.id);
          }
          continue;
        }

        // Normal chunk sync tick
        tState.chunkIndex++;
        
        // Calculate progress matching chunks
        const transferFraction = tState.chunkIndex / tState.totalChunks;
        const nextProgress = Math.min(90, Math.floor(10 + transferFraction * 80));
        
        // Dynamic speed throttled on host setting
        const factor = 0.8 + Math.random() * 0.4; // +/- 20% jitter
        const targetSpeed = Math.min(wanLimitMBs, job.type === 'UPLOAD' ? 45 : 150) * factor;
        const speedStr = `${targetSpeed.toFixed(1)} MB/s`;
        
        // ETA calculation
        const remainingMB = fileMB * (1 - transferFraction);
        const remainingSec = Math.ceil(remainingMB / targetSpeed);
        const etaStr = remainingSec <= 0 ? '1s' : `${remainingSec}s`;

        await insertLog({
          id: `log-chunk-${Date.now()}-${job.id}`,
          timestamp: nowTime,
          level: 'INFO',
          deviceId: job.sourceDevice,
          message: `[Transfer Engine] Transmitted chunk ${tState.chunkIndex}/${tState.totalChunks} of "${job.fileName}" successfully (${nextProgress}%). Secure TLS stream active.`
        });

        if (nextProgress >= 90) {
          // Progress to final validation validation stage
          await updateSyncJobProgress(job.id, 90, speedStr, 'VALIDATING' as any, 'Validating...');
          
          await insertLog({
            id: `log-validate-${Date.now()}-${job.id}`,
            timestamp: nowTime,
            level: 'INFO',
            deviceId: job.destDevice,
            message: `🔍 [Replication Core] File "${job.fileName}" bulk chunks arrived. Performing block reassembly, final SHA-256 audit, and WAN lock handshake...`
          });
        } else {
          await updateSyncJobProgress(job.id, nextProgress, speedStr, 'TRANSFERRING' as any, etaStr);
        }
        continue;
      }

      if (currentStatus === 'VALIDATING') {
        // High fidelity checksum passes ! Successfully COMPLETE the task session
        await updateSyncJobProgress(job.id, 100, '0.0 MB/s', 'COMPLETED', 'Finished');
        
        await insertLog({
          id: `log-complete-${Date.now()}-${job.id}`,
          timestamp: nowTime,
          level: 'SUCCESS',
          deviceId: job.destDevice,
          message: `✅ [Sync Engine] Replicating complete: "${job.fileName}" successfully written to destination node ${job.destDevice}. Integrity Verified.`
        });
        
        // Add final storage space impact
        const deltaMB = fileMB;
        await addDeviceStorage(job.destDevice, deltaMB);
        
        activeTasksState.delete(job.id);
        continue;
      }
    }
  } catch (err) {
    console.error('[VoxSync Queue Orchestrator] Execution failed during tick:', err);
  }
}

// Request cancellation of any active queue task
export function cancelSyncTask(id: string): boolean {
  const tState = activeTasksState.get(id);
  if (tState) {
    tState.isCancelled = true;
    return true;
  }
  return false;
}
