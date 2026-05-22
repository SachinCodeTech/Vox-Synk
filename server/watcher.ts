import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { insertLog, insertSyncJob, SyncJobRecord, getDevices } from './db.js';
import { runFilesystemIndexSweep } from './indexer.js';
import { runAISyncIntelligenceSweep } from './aiSyncIntelligence.js';

// Get clean resolution of path root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const syncDir = path.resolve(process.cwd(), 'sync_dir');

// Maintain instance reference
let watcher: chokidar.FSWatcher | null = null;
let onFsChangeCallback: ((event: string, filePath: string, stats?: fs.Stats) => void) | null = null;

// Rename correlation cache
interface DeletedFileCache {
  originalPath: string;
  filename: string;
  size: string;
  timestamp: number;
}
const deletionRegistry = new Map<string, DeletedFileCache>(); // mapped by size to detect match

// SHA-256 sync helper to prove storage authenticity
function computeChecksumSync(filePath: string): string {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return 'N/A';
    }
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  } catch (e) {
    console.error('[VoxSync Watcher] Checksum exception:', e);
    return 'UNKNOWN';
  }
}

export function initFilesystemWatcher(callback: (event: string, filePath: string) => void) {
  // Ensure watched directory physically exists so Chokidar runs successfully
  if (!fs.existsSync(syncDir)) {
    try {
      fs.mkdirSync(syncDir, { recursive: true });
      // Add a default template placeholder file
      fs.writeFileSync(
        path.join(syncDir, 'vox_project_readme.txt'),
        'VoxSync Cloud Node Shared Directory. Place architectural plans, models (.rvt, .dwg) here to test real synchronization.'
      );
    } catch (e) {
      console.error('[VoxSync Watcher] Failed to construct sync_dir sandbox directory:', e);
    }
  }

  onFsChangeCallback = (event, file) => {
    const filename = path.basename(file);
    const relativePart = path.relative(syncDir, file);
    callback(event, relativePart);
  };

  console.log(`[VoxSync Watcher] Engaging Chokidar active watcher pipeline on directory: ${syncDir}`);

  watcher = chokidar.watch(syncDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // skip existing files on boot to prevent spam
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  watcher
    .on('add', async (filePath) => {
      await handleFileEvent('ADD', filePath);
    })
    .on('change', async (filePath) => {
      await handleFileEvent('MODIFY', filePath);
    })
    .on('unlink', async (filePath) => {
      await handleFileEvent('DELETE', filePath);
    });
}

// Function to process and convert file triggers into DB records & alerts
async function handleFileEvent(action: 'ADD' | 'MODIFY' | 'DELETE', filePath: string) {
  const filename = path.basename(filePath);
  const nowTime = Date.now();
  const timestamp = new Date().toLocaleTimeString().split(' ')[0];

  let size = '0.00 MB';
  let checksum = 'N/A';
  
  if (action !== 'DELETE' && fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      size = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
      checksum = computeChecksumSync(filePath);
    } catch (e) {
      console.error('[Watcher stat error]', e);
    }
  }

  // Check rename correlation:
  // If we just had a deletion within 1.5 seconds that had EXACTLY the same file size, it's a RENAME!
  let isRename = false;
  let oldFilename = '';

  if (action === 'ADD') {
    for (const [keySize, deletion] of deletionRegistry.entries()) {
      if (nowTime - deletion.timestamp < 1500 && deletion.size === size && deletion.filename !== filename) {
        isRename = true;
        oldFilename = deletion.filename;
        deletionRegistry.delete(keySize); // consume registry item
        break;
      }
    }
  }

  if (action === 'DELETE') {
    // Save to correlation cache before passing
    const origFilename = path.basename(filePath);
    deletionRegistry.set(size, {
      originalPath: filePath,
      filename: origFilename,
      size,
      timestamp: nowTime
    });

    // Cleanup deletion registry items after 2 seconds to avoid memory leaky states
    setTimeout(() => {
      if (deletionRegistry.get(size)?.timestamp === nowTime) {
        deletionRegistry.delete(size);
      }
    }, 2000);
  }

  const idPrefix = isRename ? 'rename' : action.toLowerCase();
  const id = `${idPrefix}-job-${Date.now()}`;
  
  let logMsg = '';
  if (isRename) {
    logMsg = `[Chokidar Watcher] Real-time file rename detected: "${oldFilename}" was moved/renamed to "${filename}" inside sync_dir/. Initializing meta-mapping update.`;
  } else if (action === 'DELETE') {
    logMsg = `[Chokidar Watcher] Local file deletion tracked: "${filename}" removed from sync_dir/. Propagating clean events to WAN registry.`;
  } else {
    logMsg = `[Chokidar Watcher] Detected ${action} operation on local asset: "${filename}" inside sync_dir/. SHA-256 hash: ${checksum}. Triggering sync queue.`;
  }

  await insertLog({
    id: `log-chokidar-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp,
    level: action === 'DELETE' ? 'WARNING' : 'SUCCESS',
    deviceId: 'NYC-ARCH-DESK-01', // Local Node
    message: logMsg
  });

  // If added or modified or renamed, enqueue a physical job and register it
  if (action !== 'DELETE') {
    const dept = getDepartmentByExt(filename);
    const newJob: SyncJobRecord = {
      id,
      fileName: filename,
      size,
      sourceDevice: 'NYC-ARCH-DESK-01',
      destDevice: 'LDN-MEPF-SRV-02',
      progress: 0,
      speed: 'Calculating...',
      type: isRename ? 'REPLICATION' : 'UPLOAD',
      status: 'QUEUED', // Let the Queue Orchestrator process concurrency cleanly!
      department: dept,
      eta: 'Calculating...',
      created_at: new Date()
    };
    await insertSyncJob(newJob);
  }

  // Auto-trigger full indexing sweep and AI audit sweeps to ensure real-time intelligence is active
  runFilesystemIndexSweep()
    .then(() => runAISyncIntelligenceSweep())
    .catch((err) => console.error('[VoxSync Watcher Sweep Error]', err));

  // Trigger WebSocket callback if registered for notifying client actions
  if (onFsChangeCallback) {
    onFsChangeCallback(isRename ? 'RENAME' : action, filePath);
  }
}

// Helper to match file extension to architecture departments
function getDepartmentByExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.rvt':
      return 'Structural';
    case '.dwg':
      return 'Architecture';
    case '.max':
    case '.png':
    case '.jpg':
      return 'Renders/3D';
    case '.xlsx':
    case '.xls':
      return 'BOQ Estimations';
    default:
      return 'MEPF Engine';
  }
}

export function shutdownFilesystemWatcher() {
  if (watcher) {
    watcher.close();
    console.log('[VoxSync Watcher] Watcher safely disconnected.');
  }
}
