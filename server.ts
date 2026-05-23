import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import our modular sub-services
import { 
  getDevices, 
  getSyncJobs, 
  getLogs, 
  getAlerts, 
  insertDevice, 
  insertSyncJob, 
  insertLog, 
  updateAlertResolved,
  updateDeviceHeartbeat,
  saveDeviceUptimeAndMetrics,
  getDbHealthInfo,
  DeviceRecord,
  SyncJobRecord
} from './server/db.js';
import { cache } from './server/cache.js';
import { initFilesystemWatcher, shutdownFilesystemWatcher } from './server/watcher.js';
import { 
  registerWebSocketClient, 
  startTelemetryDaemon, 
  shutdownTelemetryDaemon, 
  setSimLoopStatus,
  broadcastMessage,
  setWanSpeedLimit,
  getActiveWebSocketCount
} from './server/telemetry.js';
import { getIndexedFiles, runFilesystemIndexSweep } from './server/indexer.js';
import { cancelSyncTask } from './server/queueOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express core
export const app = express();
app.use(express.json());

// Single port unified architecture
const HTTP_PORT = 3000;

// Subsystems lazy startup manager
let servicesStarted = false;

async function ensureServicesStarted() {
  if (servicesStarted) return;
  servicesStarted = true;
  console.log('[VoxSync Engine] Staged startup initialization beginning...');
  
  try {
    // 1. Telemetry and queue orchestrator daemon boot
    console.log('[VoxSync Engine] Booting telemetry & queue orchestrator daemon...');
    startTelemetryDaemon();
    
    // 2. Local folders filesystem watcher active engagement
    console.log('[VoxSync Engine] Launching folder filesystem watchers...');
    initFilesystemWatcher((event, filename) => {
      broadcastMessage({
        type: 'FS_CHANGE',
        data: { event, filename }
      });
    });
    
    console.log('[VoxSync Engine] Progressive integration subsystems online and active!');
  } catch (err) {
    console.error('[VoxSync Engine] Subsystem startup initialization error:', err);
  }
}

// Intercept REST calls to initialize background telemetry / watchers on-demand
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    ensureServicesStarted().catch(err => {
      console.error('[VoxSync Subsystem Error]', err);
    });
  }
  next();
});

// Setup HTTP server wrappers
const server = createHttpServer(app);

// Bind WebSocket router directly to the core HTTP server instance
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  // Allow WebSocket handshakes cleanly
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  registerWebSocketClient(ws);
});

// ==========================================
// BACKEND REST APIs & SERVICE ENDPOINTS
// ==========================================

// Graceful environment diagnostics check
function validateEnvironment() {
  const warnings: string[] = [];
  const diagnostics: Record<string, any> = {};

  const dbUrl = process.env.DATABASE_URL || process.env.PGURI;
  if (dbUrl) {
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      warnings.push('DATABASE_URL starts with non-standard prefix. Connect queries might throw.');
    }
    diagnostics.dbConfigured = true;
  } else if (process.env.PGHOST) {
    diagnostics.dbConfigured = true;
  } else {
    warnings.push('No database settings found. Utilizing resilient local Standby Fail-safe InMemoryDB.');
    diagnostics.dbConfigured = false;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDISURI;
  if (redisUrl) {
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      warnings.push('REDIS_URL provided with non-standard scheme sequence.');
    }
    diagnostics.redisConfigured = true;
  } else if (process.env.REDISHOST) {
    diagnostics.redisConfigured = true;
  } else {
    warnings.push('No Redis hosts configured. Defaulting caching provider to local in-memory store.');
    diagnostics.redisConfigured = false;
  }

  diagnostics.nodeEnv = process.env.NODE_ENV || 'production';
  return {
    valid: warnings.length === 0,
    warnings,
    diagnostics
  };
}

// Healthprobe API checked by infrastructure monitors
app.get('/api/health', (req, res) => {
  const isRedisActive = cache.isUsingRedis();
  const dbHealth = getDbHealthInfo();
  const envValidation = validateEnvironment();
  const memoryUsage = process.memoryUsage();

  const isDegraded = !dbHealth.usePostgreSQL || !isRedisActive;

  return res.json({
    status: isDegraded ? 'DEGRADED' : 'ONLINE',
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      archType: 'Full-Stack Modular Node.js (Production Ready)'
    },
    memory: {
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
    },
    services: {
      database: {
        type: dbHealth.usePostgreSQL ? 'PostgreSQL' : 'In-Memory Fallback Engine',
        active: dbHealth.usePostgreSQL,
        pool: dbHealth.poolDetails
      },
      cache: {
        type: isRedisActive ? 'Redis Client Session Store' : 'Local In-Memory KeyValue Hub',
        active: isRedisActive
      },
      sockets: {
        activeConnects: getActiveWebSocketCount(),
        standardPort: HTTP_PORT
      },
      watcher: {
        status: fs.existsSync(path.resolve(__dirname, 'sync_dir')) ? 'ONLINE_MONITORING' : 'OFFLINE_STANDBY',
        targetPath: './sync_dir/'
      }
    },
    diagnostics: {
      envValid: envValidation.valid,
      environmentMode: envValidation.diagnostics.nodeEnv,
      warningsCount: envValidation.warnings.length,
      warnings: envValidation.warnings
    }
  });
});

// API: Get connected devices list
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await getDevices();
    return res.json(devices);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Register a new enterprise node
app.post('/api/devices', async (req, res) => {
  const { hostname, ip, location, role } = req.body;
  if (!hostname || !ip) {
    return res.status(400).json({ error: 'Missing mandatory fields: hostname or IP' });
  }

  try {
    const cleanHostname = hostname.toUpperCase().replace(/\s+/g, '-');
    const newDevice: DeviceRecord = {
      id: `dev-${Date.now()}`,
      hostname: cleanHostname,
      ip,
      location: location || 'Remote office WAN',
      role: role || 'Workspace workstation',
      status: 'ONLINE',
      storageUsed: 0,
      storageTotal: 1000,
      latency: Math.floor(Math.random() * 25) + 3,
      lastSeen: 'Just registered'
    };

    await insertDevice(newDevice);

    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    await insertLog({
      id: `log-api-reg-${Date.now()}`,
      timestamp,
      level: 'SUCCESS',
      deviceId: cleanHostname,
      message: `Device configuration successfully registered. Token generated. Device established secure handshake protocol.`
    });

    // Notify all terminals immediately
    const devicesUpdated = await getDevices();
    const logsUpdated = await getLogs();
    broadcastMessage({
      type: 'STATE_UPDATE',
      data: { devices: devicesUpdated, logs: logsUpdated }
    });

    return res.status(201).json(newDevice);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Toggle device state (ONLINE/OFFLINE)
app.post('/api/devices/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const devices = await getDevices();
    const dev = devices.find(d => d.id === id);
    if (!dev) {
      return res.status(404).json({ error: 'Device node not found.' });
    }

    const nextStatus = dev.status === 'OFFLINE' ? 'ONLINE' : 'OFFLINE';
    const nextLatency = nextStatus === 'OFFLINE' ? 999 : Math.floor(Math.random() * 20) + 3;
    const nextHeartbeat = nextStatus === 'ONLINE' ? Date.now() : dev.lastHeartbeat || Date.now();

    await saveDeviceUptimeAndMetrics(
      id,
      nextStatus,
      nextLatency,
      dev.activeTransfers || 0,
      nextStatus === 'OFFLINE' ? 0 : dev.healthScore || 100,
      dev.uptimeSeconds || 0,
      nextHeartbeat
    );

    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    await insertLog({
      id: `log-toggle-power-${Date.now()}`,
      timestamp,
      level: nextStatus === 'ONLINE' ? 'SUCCESS' : 'WARNING',
      deviceId: dev.hostname,
      message: `Administrative trigger: Server node has been set structurally ${nextStatus}.`
    });

    const devicesUpdated = await getDevices();
    const logsUpdated = await getLogs();

    broadcastMessage({
      type: 'STATE_UPDATE',
      data: {
        devices: devicesUpdated,
        logs: logsUpdated
      }
    });

    return res.json({ success: true, status: nextStatus });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// API: List currently active transfers
app.get('/api/sync_jobs', async (req, res) => {
  try {
    const jobs = await getSyncJobs();
    return res.json(jobs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Inject manual synchronization job / file modification simulate event
app.post('/api/sync_jobs', async (req, res) => {
  const { fileName, department, size } = req.body;
  if (!fileName || !department) {
    return res.status(400).json({ error: 'Missing fileName or department parameter.' });
  }

  try {
    const jobSize = size || `${(Math.random() * 45 + 5).toFixed(1)} MB`;
    const newJob: SyncJobRecord = {
      id: `job-api-inject-${Date.now()}`,
      fileName,
      size: jobSize,
      sourceDevice: 'NYC-ARCH-DESK-01',
      destDevice: 'LDN-MEPF-SRV-02',
      progress: 0,
      speed: '124.8 MB/s',
      type: 'UPLOAD',
      status: 'SYNCING',
      department,
      eta: '4s',
      created_at: new Date()
    };

    await insertSyncJob(newJob);

    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    await insertLog({
      id: `log-api-inject-${Date.now()}`,
      timestamp,
      level: 'ALERT',
      deviceId: 'NYC-ARCH-DESK-01',
      message: `[API Watcher] Programmatic modification event initiated on "${fileName}" inside ${department}. Calculated size: ${jobSize}. Mapping replication.`
    });

    const jobsUpdated = await getSyncJobs();
    const logsUpdated = await getLogs();
    broadcastMessage({
      type: 'STATE_UPDATE',
      data: { syncJobs: jobsUpdated, logs: logsUpdated }
    });

    return res.status(201).json(newJob);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Fetch current logged operations
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await getLogs();
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Fetch unified system-wide DB state for fallback polling
app.get('/api/state', async (req, res) => {
  try {
    const devices = await getDevices();
    const syncJobs = await getSyncJobs();
    const logs = await getLogs();
    const alerts = await getAlerts();
    return res.json({
      devices,
      syncJobs,
      logs,
      alerts,
      cacheEngineUsed: cache.isUsingRedis() ? 'Redis' : 'Memory Cache'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Resolve active AI Sync Alert recommendation
app.post('/api/alerts/resolve', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Mandatory alert ID parameter missing.' });
  }

  try {
    await updateAlertResolved(id, true);

    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    await insertLog({
      id: `log-api-alert-resolve-${Date.now()}`,
      timestamp,
      level: 'SUCCESS',
      deviceId: 'VOX-AI-INTELLIGENCE',
      message: `Action enacted to resolve risk warning: System applied configuration to isolate corresponding dataset.`
    });

    const alertsUpdated = await getAlerts();
    const logsUpdated = await getLogs();
    broadcastMessage({
      type: 'STATE_UPDATE',
      data: { alerts: alertsUpdated, logs: logsUpdated }
    });

    return res.json({ message: 'Alert resolved successfully.', id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Toggle simulation metrics generator
app.post('/api/simulation/toggle', (req, res) => {
  const { active } = req.body;
  if (active === undefined) {
    return res.status(400).json({ error: 'Missing active boolean field.' });
  }
  setSimLoopStatus(active);
  return res.json({ status: 'OK', isSimulating: active });
});

// API: Update global WAN speed limit setting dynamically
app.post('/api/settings/wan', (req, res) => {
  const { limit } = req.body;
  if (limit === undefined || isNaN(Number(limit))) {
    return res.status(400).json({ error: 'Missing or invalid bandwidth limit number input.' });
  }
  setWanSpeedLimit(Number(limit));
  return res.json({ status: 'OK', limit: Number(limit) });
});

// API: Fetch currently indexed files from physical sync_dir/
app.get('/api/index', async (req, res) => {
  try {
    const files = getIndexedFiles();
    return res.json(files);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Manually execute a full filesystem metadata sweep
app.post('/api/index/sweep', async (req, res) => {
  try {
    const files = await runFilesystemIndexSweep();
    return res.json({ status: 'SWEPT', fileCount: files.length, files });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Cancel an active/pending sync task
app.post('/api/sync_jobs/cancel', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing sync task ID.' });
  }
  const cancelled = cancelSyncTask(id);
  return res.json({ status: cancelled ? 'CANCEL_REQUESTED' : 'NOT_FOUND', id });
});

// API: Inject write concurrency conflict simulation
app.post('/api/simulation/conflict', async (req, res) => {
  try {
    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    await insertLog({
      id: `log-api-conflict-trigger-${Date.now()}`,
      timestamp,
      level: 'ALERT',
      deviceId: 'NYC-ARCH-DESK-01',
      message: `💥 Distributed write-conflict detected! Device "LDN-MEPF-SRV-02" and workstation "NYC-ARCH-DESK-01" modified "load_bearings_bento.rvt" concurrently.`
    });

    const logsUpdated = await getLogs();
    broadcastMessage({
      type: 'STATE_UPDATE',
      data: { logs: logsUpdated }
    });

    // Notify client to trigger interactive modal
    broadcastMessage({
      type: 'CONFLICT_TRIGGERED',
      data: {
        file: 'load_bearings_bento.rvt',
        sourceDevice: 'NYC-ARCH-DESK-01',
        conflictingDevice: 'LDN-MEPF-SRV-02'
      }
    });

    return res.json({ status: 'CONFLICT_INJECTED' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API: Resolve synchronization collision strategy
app.post('/api/simulation/resolve-conflict', async (req, res) => {
  const { strategy } = req.body;
  if (!strategy) {
    return res.status(400).json({ error: 'Strategy value (server/client/both) is mandatory.' });
  }

  try {
    const timestamp = new Date().toLocaleTimeString().split(' ')[0];
    let message = '';
    if (strategy === 'server') {
      message = 'Approved Server lock (LDN-MEPF-SRV-02 version). Discarded local transient copy.';
    } else if (strategy === 'client') {
      message = 'Forced client workstation version (NYC-ARCH-DESK-01). Overwrote central cloud node with rollback snapshot created.';
    } else {
      message = 'Maintained dual-node branches: Renamed NYC workstation version to "load_bearings_bento_NYC-CONFLICT_REV.rvt". Both synced.';
    }

    await insertLog({
      id: `log-api-conflict-res-${Date.now()}`,
      timestamp,
      level: 'SUCCESS',
      deviceId: 'COLLABORATIVE-GRID',
      message: `Conflict RESOLVED via interactive policy: ${message}`
    });

    // If "both", trigger mock renamed job replication
    if (strategy === 'both') {
      const newJob: SyncJobRecord = {
        id: `job-conflict-resolved-${Date.now()}`,
        fileName: 'load_bearings_bento_NYC-CONFLICT_REV.rvt',
        size: '14.2 MB',
        sourceDevice: 'NYC-ARCH-DESK-01',
        destDevice: 'LDN-MEPF-SRV-02',
        progress: 0,
        speed: '115.4 MB/s',
        type: 'UPLOAD',
        status: 'SYNCING',
        department: 'Structural',
        eta: '6s',
        created_at: new Date()
      };
      await insertSyncJob(newJob);
    }

    const jobsUpdated = await getSyncJobs();
    const logsUpdated = await getLogs();
    broadcastMessage({
      type: 'STATE_UPDATE',
      data: { syncJobs: jobsUpdated, logs: logsUpdated }
    });

    return res.json({ status: 'RESOLVED', strategy });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SPA MULTI-MODE ROUTING PREFERENCE (VITE DEV / PRODUCTION STATIC)
// ==========================================

const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  console.log('[VoxSync Server] Development mode detected. Spawning Vite dev middleware on port 3000.');
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.error('[VoxSync Server] Failed to initialize Vite middleware in development:', err);
  }
} else {
  const clientDistPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(clientDistPath)) {
    console.log(`[VoxSync Server] Directory dist/ identified. Serving React client assets statically.`);
    app.use(express.static(clientDistPath));
    
    app.get('/:path*', (req, res) => {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    console.warn(`[VoxSync Server] Client directory dist/ not established. Run static build command first to bind UI.`);
    app.get('/', (req, res) => {
      return res.send('<h1>VoxSync Control Node APIs Operational</h1><p>Static React dashboard has not compiled yet. Complete compilation to see full interactive admin tools.</p>');
    });
  }
}

// Ensure clean shutdowns that unplug sockets and filesystem handles
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('[VoxSync Core] Commencing server shutdown sequence...');
  shutdownTelemetryDaemon();
  shutdownFilesystemWatcher();
  
  server.close(() => {
    console.log('[VoxSync Core] Server gracefully terminated.');
    process.exit(0);
  });
}

// Boot Express http listener if not in Vercel serverless context
if (!process.env.VERCEL) {
  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n=============================================================`);
    console.log(`  VOXSYNC FULL-STACK SYNC CLUSTER ACTIVE!`);
    console.log(`  Express backend & WebSockets online at port ${HTTP_PORT}`);
    console.log(`=============================================================\n`);
  });
}
