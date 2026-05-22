import { WebSocket } from 'ws';
import { 
  getDevices, 
  getSyncJobs, 
  getLogs, 
  getAlerts, 
  updateDeviceStatus, 
  insertLog, 
  insertSyncJob,
  saveDeviceUptimeAndMetrics,
  DeviceRecord,
  SyncJobRecord,
  LogRecord,
  AlertRecord
} from './db.js';
import { cache } from './cache.js';
import { tickSyncQueue } from './queueOrchestrator.js';
import { runFilesystemIndexSweep, getIndexedFiles } from './indexer.js';
import { runAISyncIntelligenceSweep } from './aiSyncIntelligence.js';

interface ExtWebSocket extends WebSocket {
  isAlive?: boolean;
}

const connectedClients = new Set<ExtWebSocket>();
let heartbeatInterval: NodeJS.Timeout | null = null;
let telemetryInterval: NodeJS.Timeout | null = null;
let isSimulationActive = true;
let globalWanLimitSpeed = 500; // in MB/s
let ticksCount = 0;

export function getActiveWebSocketCount(): number {
  return connectedClients.size;
}


export function setSimLoopStatus(active: boolean) {
  isSimulationActive = active;
  console.log(`[VoxSync Telemetry] Global Simulation active state shifted to: ${active}`);
}

export function setWanSpeedLimit(limit: number) {
  globalWanLimitSpeed = limit;
  console.log(`[VoxSync Telemetry] Dynamic WAN Throttling limit set to ${limit} MB/s`);
}

export function registerWebSocketClient(ws: WebSocket) {
  const extWs = ws as ExtWebSocket;
  extWs.isAlive = true;
  
  connectedClients.add(extWs);
  console.log(`[VoxSync WS] Socket registration success. Total active terminals: ${connectedClients.size}`);

  pushInitialState(extWs);

  extWs.on('pong', () => {
    extWs.isAlive = true;
  });

  extWs.on('close', () => {
    connectedClients.delete(extWs);
    console.log(`[VoxSync WS] Terminated socket connection. Total active terminals: ${connectedClients.size}`);
  });

  extWs.on('error', (err) => {
    console.error(`[VoxSync WS] Socket transmission fault:`, err);
    connectedClients.delete(extWs);
  });
}

export function broadcastMessage(data: any) {
  const payload = JSON.stringify(data);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('[VoxSync WS] Failed to marshal socket message:', err);
      }
    }
  }
}

async function pushInitialState(ws: WebSocket) {
  try {
    const devices = await getDevices();
    const syncJobs = await getSyncJobs();
    const logs = await getLogs();
    const alerts = await getAlerts();

    await cache.set('vox_last_sync_metrics', JSON.stringify({
      deviceCount: devices.length,
      activeJobsCount: syncJobs.filter(j => j.status === 'SYNCING').length,
      integrityScore: 100.0
    }), 30);

    const payload = {
      type: 'INITIAL_STATE',
      data: {
        devices,
        syncJobs,
        logs,
        alerts,
        cacheEngineUsed: cache.isUsingRedis() ? 'Redis' : 'Memory Cache'
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  } catch (error) {
    console.error('[VoxSync WS] Failed to compile baseline initial state:', error);
  }
}

// Trigger telemetry, files index sweep, and intelligence analysis
export async function triggerFilesAndAISweeps(): Promise<void> {
  const timeNow = new Date().toLocaleTimeString().split(' ')[0];
  try {
    // 1. Sweep physical directory for indexing
    await runFilesystemIndexSweep();
    
    // 2. Run AI intelligence on those files
    await runAISyncIntelligenceSweep();
    
    // 3. Log optimization completed
    await insertLog({
      id: `log-telemetry-sweep-${Date.now()}`,
      timestamp: timeNow,
      level: 'INFO',
      deviceId: 'VOX-AI-INTELLIGENCE',
      message: `[AI Sync Engine] Completed recursive index audit on sync_dir/. Successfully verified cryptographic block-chain state and compiled predictive risk suggestions.`
    });
  } catch (err) {
    console.error('[VoxSync Telemetry] Error running indices sweeps:', err);
  }
}

export function startTelemetryDaemon() {
  if (telemetryInterval) clearInterval(telemetryInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  // Setup WS heartbeat check every 15 seconds
  heartbeatInterval = setInterval(() => {
    connectedClients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.warn(`[VoxSync WS Monitoring] Connection timed out. Terminating stale websocket connection.`);
        ws.terminate();
        connectedClients.delete(ws);
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (err) {
        console.error('[VoxSync WS Ping Err]', err);
        ws.terminate();
        connectedClients.delete(ws);
      }
    });
  }, 15000);

  // Kick off initial filesystem sweep asynchronously immediately on daemon start
  triggerFilesAndAISweeps().catch(err => {
    console.error('[VoxSync] Initial startup filesystem sweep error:', err);
  });

  // Telemetry loop runs every 3 seconds
  telemetryInterval = setInterval(async () => {
    ticksCount++;
    try {
      // 1. Process sync jobs queue through State Machine with current dynamic throttling MBs
      await tickSyncQueue(globalWanLimitSpeed);

      // 2. Periodic background checks: Run a quiet index/intelligence sweep every 4 ticks (12 seconds)
      if (ticksCount % 4 === 0) {
        await runFilesystemIndexSweep();
        await runAISyncIntelligenceSweep();
      }

      // 3. Update dynamic device health scoring, heartbeats, active transfers, and uptime
      const devices = await getDevices();
      const currentJobs = await getSyncJobs();
      
      for (const dev of devices) {
        // Count active transfers across sync_jobs
        const activeTransfersCount = currentJobs.filter(j => 
          (j.status === 'SYNCING' || j.status === 'VERIFYING' || j.status === 'TRANSFERRING' || j.status === 'VALIDATING') &&
          (j.sourceDevice === dev.hostname || j.destDevice === dev.hostname)
        ).length;

        let nextStatus = dev.status;
        let nextLatency = dev.latency;
        let nextUptime = dev.uptimeSeconds || 0;
        let nextHeartbeat = dev.lastHeartbeat || Date.now();
        let healthScore = 100;

        if (dev.status !== 'OFFLINE') {
          nextUptime += 3;
          
          // Continuous heartbeats simulation for active system-defined node assets
          const isSystemSimulatedNode = ['NYC-ARCH-DESK-01', 'LDN-MEPF-SRV-02', 'SGP-BOQ-STUDIO-05', 'PAR-STR-DESK-11'].includes(dev.hostname);
          if (isSimulationActive && isSystemSimulatedNode) {
            nextHeartbeat = Date.now();
          }

          const age = Date.now() - nextHeartbeat;
          if (age > 15000) {
            // Heartbeat expired! Mark offline
            nextStatus = 'OFFLINE';
            nextLatency = 999;
            healthScore = 0;
            
            const timeNow = new Date().toLocaleTimeString().split(' ')[0];
            await insertLog({
              id: `log-expired-${Date.now()}-${dev.id}`,
              timestamp: timeNow,
              level: 'ALERT',
              deviceId: dev.hostname,
              message: `🚨 [Health Monitor] Vital heartbeat silent for "${dev.hostname}". Connection timed out after 15,000ms. Node state expired to OFFLINE.`
            });
          } else {
            // Normal online node operations
            // Simulate direct latency jitter
            const jitter = Math.floor(Math.random() * 4) - 2;
            nextLatency = Math.max(2, dev.latency + jitter);
            
            // Map status automatically based on whether transmissions are in progress
            nextStatus = activeTransfersCount > 0 ? 'SYNCING' : 'ONLINE';
            
            // Health Index Calculation Policy
            let penalty = 0;
            if (nextLatency > 15) {
              penalty += Math.min(25, Math.floor((nextLatency - 15) / 4));
            }
            const storageRatio = dev.storageUsed / dev.storageTotal;
            if (storageRatio >= 0.85) {
              penalty += 15;
            } else if (storageRatio >= 0.95) {
              penalty += 30;
            }
            // Minor heartbeat jitter deduction
            if (age > 8000) {
              penalty += 10;
            }
            healthScore = Math.max(1, 100 - penalty);
          }
        } else {
          healthScore = 0;
          nextLatency = 999;
        }

        await saveDeviceUptimeAndMetrics(
          dev.id,
          nextStatus,
          nextLatency,
          activeTransfersCount,
          healthScore,
          nextUptime,
          nextHeartbeat
        );
      }

      // 4. If simulation is active and no transfers are running, inject background tasks for endless visual flow
      if (isSimulationActive) {
        const uncompletedCount = currentJobs.filter(j => 
          j.status === 'QUEUED' || 
          j.status === 'SYNCING' || 
          j.status === 'VERIFYING' || 
          j.status === 'TRANSFERRING' || 
          j.status === 'VALIDATING'
        ).length;

        if (uncompletedCount === 0) {
          const filesPool = [
            { name: 'hvac_simulation_test.dwg', size: '44.8 MB', dept: 'MEPF Engine', type: 'DOWNLOAD' as const, source: 'LDN-MEPF-SRV-02', dest: 'NYC-ARCH-DESK-01' },
            { name: 'exterior_glass_render_4k.png', size: '189.2 MB', dept: 'Renders/3D', type: 'UPLOAD' as const, source: 'NYC-ARCH-DESK-01', dest: 'PAR-STR-DESK-11' },
            { name: 'seismic_calc_sheet_rev3.xls', size: '1.2 MB', dept: 'Structural', type: 'REPLICATION' as const, source: 'PAR-STR-DESK-11', dest: 'NYC-ARCH-DESK-01' },
            { name: 'boq_bento_tower_v4.xlsx', size: '12.4 MB', dept: 'BOQ Estimations', type: 'UPLOAD' as const, source: 'NYC-ARCH-DESK-01', dest: 'SGP-BOQ-STUDIO-05' }
          ];
          
          const indexToInfect = Math.floor(Math.random() * filesPool.length);
          const selFile = filesPool[indexToInfect];

          const newJob: SyncJobRecord = {
            id: `job-telemetry-gen-${Date.now()}`,
            fileName: selFile.name,
            size: selFile.size,
            sourceDevice: selFile.source,
            destDevice: selFile.dest,
            progress: 0,
            speed: '0.0 MB/s',
            status: 'QUEUED',
            type: selFile.type,
            department: selFile.dept,
            eta: 'Calculating...',
            created_at: new Date()
          };

          await insertSyncJob(newJob);
        }

        // Periodic system intelligence logs
        if (Math.random() > 0.85) {
          const telemetryEvents = [
            { level: 'INFO' as const, msg: '[Transfer Engine] Peer validation loop completed. Optimized WAN-Direct latency checks: ALL green.' },
            { level: 'SUCCESS' as const, msg: '[Replication Core] SGP and NYC regional cluster files registry matches with 100% block convergence.' },
            { level: 'WARNING' as const, msg: '[Bridge Shield] WAN packet drop detected. Sliding congestion window automatically adjusted.' }
          ];
          const randomEv = telemetryEvents[Math.floor(Math.random() * telemetryEvents.length)];
          const timeNow = new Date().toLocaleTimeString().split(' ')[0];

          await insertLog({
            id: `log-telemetry-event-${Date.now()}`,
            timestamp: timeNow,
            level: randomEv.level,
            deviceId: 'COLLABORATIVE-GRID',
            message: randomEv.msg
          });
        }
      }

      // 4. Fetch the final consolidated state from the database and broadcast to all connected web control panels
      const finalDevices = await getDevices();
      const finalJobs = await getSyncJobs();
      const finalLogs = await getLogs();
      const finalAlerts = await getAlerts();

      broadcastMessage({
        type: 'STATE_UPDATE',
        data: {
          devices: finalDevices,
          syncJobs: finalJobs,
          logs: finalLogs,
          alerts: finalAlerts,
          isSimulating: isSimulationActive
        }
      });
      
    } catch (err) {
      console.error('[VoxSync Telemetry] Heartbeat daemon encountered issues:', err);
    }
  }, 3000);
}

export function shutdownTelemetryDaemon() {
  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
    console.log('[VoxSync Telemetry] Stopped active heartbeat daemon.');
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[VoxSync Telemetry] Cleaned up websocket monitoring intervals.');
  }
}
