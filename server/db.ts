import pg from 'pg';

// ==========================================================
// POSTGRESQL CONNECTION POOL WITH GRACEFUL LOCAL FALLBACK
// ==========================================================

const { Pool } = pg;

// Define interfaces for persistent tables
export interface DeviceRecord {
  id: string;
  hostname: string;
  ip: string;
  location: string;
  role: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING';
  storageUsed: number;
  storageTotal: number;
  latency: number;
  lastSeen: string;
  activeTransfers?: number;
  lastHeartbeat?: number;
  healthScore?: number;
  uptimeSeconds?: number;
}

export interface SyncJobRecord {
  id: string;
  fileName: string;
  size: string;
  sourceDevice: string;
  destDevice: string;
  progress: number;
  speed: string;
  type: 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION';
  status: 'QUEUED' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  department: string;
  eta: string;
  created_at: Date;
}

export interface LogRecord {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  deviceId: string;
  message: string;
}

export interface AlertRecord {
  id: string;
  title: string;
  type: 'DUPLICATE' | 'STALE' | 'OVERSIZED' | 'CONFLICT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  details: string;
  recommendation: string;
  resolved: boolean;
}

// In-Memory fallback repositories representing structural tables
class InMemoryDatabase {
  devices: DeviceRecord[] = [
    { id: 'dev-1', hostname: 'NYC-ARCH-DESK-01', ip: '10.240.10.31', location: 'New York (LAN)', role: 'Lead Architect Workstation', status: 'SYNCING', storageUsed: 384, storageTotal: 1000, latency: 4, lastSeen: 'Just now', activeTransfers: 1, lastHeartbeat: Date.now(), healthScore: 98, uptimeSeconds: 32050 },
    { id: 'dev-2', hostname: 'LDN-MEPF-SRV-02', ip: '10.240.20.12', location: 'London WAN', role: 'Central MEP Engineering Vault', status: 'SYNCING', storageUsed: 2240, storageTotal: 8000, latency: 14, lastSeen: 'Just now', activeTransfers: 2, lastHeartbeat: Date.now(), healthScore: 95, uptimeSeconds: 154200 },
    { id: 'dev-3', hostname: 'SGP-BOQ-STUDIO-05', ip: '10.245.40.8', location: 'Singapore WAN', role: 'BOQ Estimations Server', status: 'ONLINE', storageUsed: 120, storageTotal: 500, latency: 38, lastSeen: '2m ago', activeTransfers: 1, lastHeartbeat: Date.now() - 4000, healthScore: 91, uptimeSeconds: 8400 },
    { id: 'dev-4', hostname: 'PAR-STR-DESK-11', ip: '10.240.30.45', location: 'Paris LAN', role: 'Structural Modeling Node', status: 'ONLINE', storageUsed: 412, storageTotal: 1000, latency: 8, lastSeen: '1m ago', activeTransfers: 0, lastHeartbeat: Date.now() - 2000, healthScore: 99, uptimeSeconds: 41200 },
    { id: 'dev-5', hostname: 'TYO-VRT-RENDER-03', ip: '10.198.80.99', location: 'Tokyo WAN', role: 'GPU Render Farm Coordinator', status: 'OFFLINE', storageUsed: 6200, storageTotal: 12000, latency: 154, lastSeen: '3h ago', activeTransfers: 0, lastHeartbeat: Date.now() - 3600000, healthScore: 0, uptimeSeconds: 0 }
  ];

  syncJobs: SyncJobRecord[] = [
    { id: 'job-1', fileName: 'foundation_detail_v6.rvt', size: '142.4 MB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'LDN-MEPF-SRV-02', progress: 54, speed: '142.5 MB/s', type: 'REPLICATION', status: 'SYNCING', department: 'Structural', eta: '12s', created_at: new Date() },
    { id: 'job-2', fileName: 'mep_layout_basement.dwg', size: '18.9 MB', sourceDevice: 'LDN-MEPF-SRV-02', destDevice: 'NYC-ARCH-DESK-01', progress: 32, speed: '18.4 MB/s', type: 'DOWNLOAD', status: 'SYNCING', department: 'MEPF Engine', eta: '4s', created_at: new Date() },
    { id: 'job-3', fileName: 'boq_estimate_rev2.xlsx', size: '4.2 MB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'SGP-BOQ-STUDIO-05', progress: 85, speed: '2.8 MB/s', type: 'UPLOAD', status: 'SYNCING', department: 'BOQ Estimations', eta: '1s', created_at: new Date() },
    { id: 'job-4', fileName: 'lobby_atrium_cycles.max', size: '1.4 GB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'PAR-STR-DESK-11', progress: 0, speed: '0.0 MB/s', type: 'REPLICATION', status: 'QUEUED', department: 'Renders/3D', eta: 'Waiting', created_at: new Date() },
    { id: 'job-5', fileName: 'structural_girder_loads.pdf', size: '8.4 MB', sourceDevice: 'PAR-STR-DESK-11', destDevice: 'LDN-MEPF-SRV-02', progress: 100, speed: '48.9 MB/s', type: 'UPLOAD', status: 'COMPLETED', department: 'Structural', eta: 'Finished', created_at: new Date() }
  ];

  logs: LogRecord[] = [
    { id: 'log-1', timestamp: '10:39:01', level: 'INFO', deviceId: 'NYC-ARCH-DESK-01', message: 'Established TLS 1.3 socket layer with Paris workstation PAR-STR-DESK-11.' },
    { id: 'log-2', timestamp: '10:39:03', level: 'SUCCESS', deviceId: 'LDN-MEPF-SRV-02', message: 'Verified SHA-256 block-data integrity check for model "foundation_detail_v6.rvt" chunk 14.' },
    { id: 'log-3', timestamp: '10:39:05', level: 'INFO', deviceId: 'SGP-BOQ-STUDIO-05', message: 'Heartbeat validated. Calculated WAN optimization ratio: 4.1x compression active.' },
    { id: 'log-4', timestamp: '10:39:06', level: 'ALERT', deviceId: 'NYC-ARCH-DESK-01', message: 'Detected active concurrency conflict on: /PB-HUB/ST/structural_layout.rvt. Machine LDN-MEPF-SRV-02 holds draft locks.' },
    { id: 'log-5', timestamp: '10:39:08', level: 'WARNING', deviceId: 'TYO-VRT-RENDER-03', message: 'Server ping check timed out over Tokyo Node WAN pipeline. Marking local instance OFFLINE.' },
    { id: 'log-6', timestamp: '10:39:10', level: 'SUCCESS', deviceId: 'NYC-ARCH-DESK-01', message: 'Simulated LAN Direct peer discovery matched NYC-ARCH-DESK-01 with 10.240.10.31.' }
  ];

  alerts: AlertRecord[] = [
    { id: 'al-1', title: 'Stale Folder Active Sync Mapping', type: 'STALE', severity: 'MEDIUM', file: '/ProjectAlpha/BOQ/2025_estimates_old/', details: 'This folder containing 18 XLS files hasn\'t changed for 124 days, yet it continues to execute heartbeat validation hooks every 5 minutes across WAN nodes.', recommendation: 'Move to VoxZip Archiver and map to standby cloud storage to save 4% overhead.', resolved: false },
    { id: 'al-2', title: 'Duplicate CAD Drafting Files Found', type: 'DUPLICATE', severity: 'HIGH', file: 'mep_layout_basement(Copy).dwg', details: 'Identical SHA-256 binary hash detected in NY-Node & LDN-Server under different structural file namespaces.', recommendation: 'Execute auto-consolidate to match baseline and keep latest file references.', resolved: false },
    { id: 'al-3', title: 'Oversized Asset WAN Delay Suggestion', type: 'OVERSIZED', severity: 'LOW', file: 'highres_atrium_panoramic_360.png', details: 'File size is 4.8 GB. Direct WAN upload mapped from New York to Singapore Office is choking workstation network pipes.', recommendation: 'Defer the synchronization of Renders background files to off-peak hours (after 19:00 local time) via Sync Scheduling Rule.', resolved: false }
  ];
}

export const inMemoryDb = new InMemoryDatabase();

let pgPool: pg.Pool | null = null;
let usePostgreSQL = false;

// Attempt to initialize real PostgreSQL connection pool only if PG configured variables are available
const connectionString = process.env.DATABASE_URL || process.env.PGURI;
if (connectionString || (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD)) {
  try {
    pgPool = new Pool({
      connectionString,
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
      max: 10, // production-grade connection pooling size limit
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    // Quick probe to see if Postgres matches and handles handshake cleanly
    pgPool.query('SELECT NOW()', (err) => {
      if (err) {
        console.warn(`[VoxSync DB] PostgreSQL pool created but failed connection probe. Falling back to high-fidelity In-Memory Database.`);
        usePostgreSQL = false;
      } else {
        console.log(`[VoxSync DB] PostgreSQL pooled connection successfully established is active.`);
        usePostgreSQL = true;
        // Run migrations if needed
        bootstrapPostgreSQLSchema();
      }
    });
  } catch (error) {
    console.error(`[VoxSync DB] Failed to initialize pg.Pool safely:`, error);
    usePostgreSQL = false;
  }
} else {
  console.log(`[VoxSync DB] No PostgreSQL connection string identified in env. Using in-memory enterprise storage engine.`);
}

async function bootstrapPostgreSQLSchema() {
  if (!pgPool || !usePostgreSQL) return;
  
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(100) PRIMARY KEY,
      hostname VARCHAR(100) NOT NULL UNIQUE,
      ip VARCHAR(50) NOT NULL,
      location VARCHAR(100) NOT NULL,
      role VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      storage_used NUMERIC NOT NULL,
      storage_total NUMERIC NOT NULL,
      latency INTEGER NOT NULL,
      last_seen VARCHAR(100) NOT NULL,
      active_transfers INTEGER DEFAULT 0,
      last_heartbeat NUMERIC,
      health_score INTEGER DEFAULT 100,
      uptime_seconds INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id VARCHAR(100) PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      size VARCHAR(50) NOT NULL,
      source_device VARCHAR(100) NOT NULL,
      dest_device VARCHAR(100) NOT NULL,
      progress REAL NOT NULL,
      speed VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      department VARCHAR(100) NOT NULL,
      eta VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(100) PRIMARY KEY,
      timestamp VARCHAR(50) NOT NULL,
      level VARCHAR(50) NOT NULL,
      device_id VARCHAR(100) NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(50) NOT NULL,
      file TEXT NOT NULL,
      details TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      resolved BOOLEAN DEFAULT FALSE
    );
  `;
  
  try {
    await pgPool.query(createTablesQuery);
    
    // Schema Evolution Migrations (Adding columns dynamically to pre-existing tables)
    try {
      await pgPool.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS active_transfers INTEGER DEFAULT 0');
      await pgPool.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_heartbeat NUMERIC');
      await pgPool.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100');
      await pgPool.query('ALTER TABLE devices ADD COLUMN IF NOT EXISTS uptime_seconds INTEGER DEFAULT 0');
    } catch (migErr) {
      console.warn('[VoxSync DB] Non-fatal migration check complete. Columns already present.');
    }

    console.log(`[VoxSync DB] PostgreSQL database schemas bootstrapped successfully.`);
    
    // Seed devices table if empty
    const { rows } = await pgPool.query('SELECT COUNT(*) FROM devices');
    if (parseInt(rows[0].count) === 0) {
      console.log('[VoxSync DB] Seeding initial PostgreSQL state values...');
      for (const d of inMemoryDb.devices) {
        await pgPool.query(
          `INSERT INTO devices (id, hostname, ip, location, role, status, storage_used, storage_total, latency, last_seen, active_transfers, last_heartbeat, health_score, uptime_seconds)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [d.id, d.hostname, d.ip, d.location, d.role, d.status, d.storageUsed, d.storageTotal, d.latency, d.lastSeen, d.activeTransfers || 0, d.lastHeartbeat || Date.now(), d.healthScore || 100, d.uptimeSeconds || 0]
        );
      }
      for (const j of inMemoryDb.syncJobs) {
        await pgPool.query(
          `INSERT INTO sync_jobs (id, file_name, size, source_device, dest_device, progress, speed, type, status, department, eta, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [j.id, j.fileName, j.size, j.sourceDevice, j.destDevice, j.progress, j.speed, j.type, j.status, j.department, j.eta, j.created_at]
        );
      }
      for (const l of inMemoryDb.logs) {
        await pgPool.query(
          `INSERT INTO logs (id, timestamp, level, device_id, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [l.id, l.timestamp, l.level, l.deviceId, l.message]
        );
      }
      for (const a of inMemoryDb.alerts) {
        await pgPool.query(
          `INSERT INTO alerts (id, title, type, severity, file, details, recommendation, resolved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [a.id, a.title, a.type, a.severity, a.file, a.details, a.recommendation, a.resolved]
        );
      }
      console.log('[VoxSync DB] Seed content written successfully.');
    }
  } catch (error) {
    console.error('[VoxSync DB] Migration/seeding failed:', error);
  }
}

// ==========================================
// DB WRAPPER INTERFACE METHODS
// ==========================================

export async function getDevices(): Promise<DeviceRecord[]> {
  if (usePostgreSQL && pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM devices ORDER BY hostname ASC');
      return rows.map(r => ({
        id: r.id,
        hostname: r.hostname,
        ip: r.ip,
        location: r.location,
        role: r.role,
        status: r.status as any,
        storageUsed: Number(r.storage_used),
        storageTotal: Number(r.storage_total),
        latency: r.latency,
        lastSeen: r.last_seen,
        activeTransfers: r.active_transfers !== null ? Number(r.active_transfers) : 0,
        lastHeartbeat: r.last_heartbeat !== null ? Number(r.last_heartbeat) : Date.now(),
        healthScore: r.health_score !== null ? Number(r.health_score) : 100,
        uptimeSeconds: r.uptime_seconds !== null ? Number(r.uptime_seconds) : 0
      }));
    } catch (e) {
      console.error('[VoxSync DB] Postgres query failed, falling back to in-memory: ', e);
    }
  }
  return [...inMemoryDb.devices];
}

export async function insertDevice(device: DeviceRecord): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO devices (id, hostname, ip, location, role, status, storage_used, storage_total, latency, last_seen, active_transfers, last_heartbeat, health_score, uptime_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (hostname) DO UPDATE SET
           status = EXCLUDED.status,
           ip = EXCLUDED.ip,
           location = EXCLUDED.location,
           role = EXCLUDED.role,
           last_seen = EXCLUDED.last_seen,
           active_transfers = EXCLUDED.active_transfers,
           last_heartbeat = EXCLUDED.last_heartbeat,
           health_score = EXCLUDED.health_score,
           uptime_seconds = EXCLUDED.uptime_seconds`,
        [
          device.id, 
          device.hostname, 
          device.ip, 
          device.location, 
          device.role, 
          device.status, 
          device.storageUsed, 
          device.storageTotal, 
          device.latency, 
          device.lastSeen,
          device.activeTransfers || 0,
          device.lastHeartbeat || Date.now(),
          device.healthScore || 100,
          device.uptimeSeconds || 0
        ]
      );
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres save error: ', e);
    }
  }
  
  const existingIdx = inMemoryDb.devices.findIndex(d => d.hostname === device.hostname);
  if (existingIdx !== -1) {
    inMemoryDb.devices[existingIdx] = {
      ...inMemoryDb.devices[existingIdx],
      ...device
    };
  } else {
    inMemoryDb.devices.push({
      ...device,
      activeTransfers: device.activeTransfers || 0,
      lastHeartbeat: device.lastHeartbeat || Date.now(),
      healthScore: device.healthScore || 100,
      uptimeSeconds: device.uptimeSeconds || 0
    });
  }
}

export async function updateDeviceHeartbeat(hostname: string, latency?: number): Promise<void> {
  const now = Date.now();
  if (usePostgreSQL && pgPool) {
    try {
      if (latency !== undefined) {
        await pgPool.query(
          `UPDATE devices 
           SET last_heartbeat = $1, last_seen = $2, latency = $3, status = CASE WHEN status = 'OFFLINE' THEN 'ONLINE' ELSE status END
           WHERE hostname = $4`,
          [now, 'Just now', latency, hostname]
        );
      } else {
        await pgPool.query(
          `UPDATE devices 
           SET last_heartbeat = $1, last_seen = $2, status = CASE WHEN status = 'OFFLINE' THEN 'ONLINE' ELSE status END
           WHERE hostname = $3`,
          [now, 'Just now', hostname]
        );
      }
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres update device heartbeat error: ', e);
    }
  }
  
  const dev = inMemoryDb.devices.find(d => d.hostname === hostname);
  if (dev) {
    dev.lastHeartbeat = now;
    dev.lastSeen = 'Just now';
    if (dev.status === 'OFFLINE') {
      dev.status = 'ONLINE';
    }
    if (latency !== undefined) {
      dev.latency = latency;
    }
  }
}

export async function saveDeviceUptimeAndMetrics(
  id: string, 
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING',
  latency: number, 
  activeTransfers: number, 
  healthScore: number, 
  uptimeSeconds: number,
  lastHeartbeat?: number
): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      if (lastHeartbeat !== undefined) {
        await pgPool.query(
          `UPDATE devices 
           SET status = $1, latency = $2, active_transfers = $3, health_score = $4, uptime_seconds = $5, last_heartbeat = $6 
           WHERE id = $7`,
          [status, latency, activeTransfers, healthScore, uptimeSeconds, lastHeartbeat, id]
        );
      } else {
        await pgPool.query(
          `UPDATE devices 
           SET status = $1, latency = $2, active_transfers = $3, health_score = $4, uptime_seconds = $5 
           WHERE id = $6`,
          [status, latency, activeTransfers, healthScore, uptimeSeconds, id]
        );
      }
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres save device metrics error: ', e);
    }
  }
  
  const dev = inMemoryDb.devices.find(d => d.id === id);
  if (dev) {
    dev.status = status;
    dev.latency = latency;
    dev.activeTransfers = activeTransfers;
    dev.healthScore = healthScore;
    dev.uptimeSeconds = uptimeSeconds;
    if (lastHeartbeat !== undefined) {
      dev.lastHeartbeat = lastHeartbeat;
    }
  }
}

export async function updateDeviceStatus(id: string, status: 'ONLINE' | 'OFFLINE' | 'SYNCING', latency?: number): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      if (latency !== undefined) {
        await pgPool.query('UPDATE devices SET status = $1, latency = $2, last_seen = $3 WHERE id = $4', [status, latency, 'Just now', id]);
      } else {
        await pgPool.query('UPDATE devices SET status = $1, last_seen = $2 WHERE id = $3', [status, 'Just now', id]);
      }
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres update device status error: ', e);
    }
  }
  
  const dev = inMemoryDb.devices.find(d => d.id === id);
  if (dev) {
    dev.status = status;
    dev.lastSeen = 'Just now';
    if (latency !== undefined) {
      dev.latency = latency;
    }
  }
}

export async function addDeviceStorage(hostname: string, storageDeltaMB: number): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query(
        'UPDATE devices SET storage_used = LEAST(storage_total, storage_used + $1) WHERE hostname = $2',
        [storageDeltaMB, hostname]
      );
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres add device storage error: ', e);
    }
  }
  
  const dev = inMemoryDb.devices.find(d => d.hostname === hostname);
  if (dev) {
    dev.storageUsed = Math.min(dev.storageTotal, dev.storageUsed + storageDeltaMB);
  }
}

export async function getSyncJobs(): Promise<SyncJobRecord[]> {
  if (usePostgreSQL && pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM sync_jobs ORDER BY created_at DESC');
      return rows.map(r => ({
        id: r.id,
        fileName: r.file_name,
        size: r.size,
        sourceDevice: r.source_device,
        destDevice: r.dest_device,
        progress: Number(r.progress),
        speed: r.speed,
        type: r.type as any,
        status: r.status as any,
        department: r.department,
        eta: r.eta,
        created_at: r.created_at
      }));
    } catch (e) {
      console.error('[VoxSync DB] Postgres jobs query error: ', e);
    }
  }
  return [...inMemoryDb.syncJobs];
}

export async function insertSyncJob(job: SyncJobRecord): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO sync_jobs (id, file_name, size, source_device, dest_device, progress, speed, type, status, department, eta, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [job.id, job.fileName, job.size, job.sourceDevice, job.destDevice, job.progress, job.speed, job.type, job.status, job.department, job.eta, job.created_at]
      );
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres job insert error: ', e);
    }
  }
  inMemoryDb.syncJobs.unshift(job);
}

export async function updateSyncJobProgress(id: string, progress: number, speed: string, status: 'QUEUED' | 'SYNCING' | 'COMPLETED' | 'FAILED', eta: string): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query(
        'UPDATE sync_jobs SET progress = $1, speed = $2, status = $3, eta = $4 WHERE id = $5',
        [progress, speed, status, eta, id]
      );
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres job progress update error: ', e);
    }
  }
  
  const job = inMemoryDb.syncJobs.find(j => j.id === id);
  if (job) {
    job.progress = progress;
    job.speed = speed;
    job.status = status;
    job.eta = eta;
  }
}

export async function getLogs(): Promise<LogRecord[]> {
  if (usePostgreSQL && pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
      return rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        level: r.level as any,
        deviceId: r.device_id,
        message: r.message
      }));
    } catch (e) {
      console.error('[VoxSync DB] Postgres logs query error: ', e);
    }
  }
  return [...inMemoryDb.logs];
}

export async function insertLog(log: LogRecord): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query(
        'INSERT INTO logs (id, timestamp, level, device_id, message) VALUES ($1, $2, $3, $4, $5)',
        [log.id, log.timestamp, log.level, log.deviceId, log.message]
      );
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres log insert error: ', e);
    }
  }
  inMemoryDb.logs.unshift(log);
  if (inMemoryDb.logs.length > 50) {
    inMemoryDb.logs.pop();
  }
}

export async function getAlerts(): Promise<AlertRecord[]> {
  if (usePostgreSQL && pgPool) {
    try {
      const { rows } = await pgPool.query('SELECT * FROM alerts ORDER BY resolved ASC, id DESC');
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type as any,
        severity: r.severity as any,
        file: r.file,
        details: r.details,
        recommendation: r.recommendation,
        resolved: r.resolved
      }));
    } catch (e) {
      console.error('[VoxSync DB] Postgres alerts query error: ', e);
    }
  }
  return [...inMemoryDb.alerts];
}

export async function updateAlertResolved(id: string, resolved: boolean): Promise<void> {
  if (usePostgreSQL && pgPool) {
    try {
      await pgPool.query('UPDATE alerts SET resolved = $1 WHERE id = $2', [resolved, id]);
      return;
    } catch (e) {
      console.error('[VoxSync DB] Postgres alert update resolved error: ', e);
    }
  }
  
  const alert = inMemoryDb.alerts.find(a => a.id === id);
  if (alert) {
    alert.resolved = resolved;
  }
}

export function getDbHealthInfo() {
  return {
    usePostgreSQL,
    hasPool: pgPool !== null,
    poolDetails: pgPool ? {
      totalConnections: pgPool.totalCount || 0,
      idleConnections: pgPool.idleCount || 0,
      waitingRequests: pgPool.waitingCount || 0,
    } : null
  };
}

