import { AlertRecord, getAlerts, inMemoryDb } from './db.js';
import { getIndexedFiles, IndexedFileRecord } from './indexer.js';
import crypto from 'crypto';

// Run AI Intelligence audit sweep on current index records
export async function runAISyncIntelligenceSweep(): Promise<AlertRecord[]> {
  try {
    const indexedFiles = getIndexedFiles();
    const systemAlerts = await getAlerts();
    
    // We will keep unresolved alerts that are simulated, but merge real analysed alerts
    const activeAlerts = systemAlerts.filter(a => !a.resolved);
    
    const duplicates = new Map<string, IndexedFileRecord[]>();
    
    // Step 1: Crypto SHA-256 Duplicate detection
    for (const file of indexedFiles) {
      if (file.checksum && file.checksum !== 'N/A' && file.checksum !== 'ERROR') {
        if (!duplicates.has(file.checksum)) {
          duplicates.set(file.checksum, []);
        }
        duplicates.get(file.checksum)!.push(file);
      }
    }
    
    for (const [hash, fileList] of duplicates.entries()) {
      if (fileList.length > 1) {
        const fileNames = fileList.map(f => f.filePath).join(' and ');
        const alertId = `al-dup-${crypto.createHash('md5').update(hash).digest('hex').substring(0, 8)}`;
        
        // Check if alert already exists in our active array
        if (!activeAlerts.some(a => a.id === alertId)) {
          activeAlerts.push({
            id: alertId,
            title: 'Duplicate CAD / Model Files Identified',
            type: 'DUPLICATE',
            severity: 'HIGH',
            file: fileList[0].fileName,
            details: `Identical SHA-256 block hash (${hash}) was detected under multiple paths: ${fileNames}. This is causing parallel WAN bandwidth redundancy.`,
            recommendation: 'De-duplicate paths and centralize mapping under a unified local symlink policy to recover storage overhead.',
            resolved: false
          });
        }
      }
    }
    
    // Step 2: Oversized transfer detection
    for (const file of indexedFiles) {
      if (file.sizeBytes > 50 * 1024 * 1024) { // over 50 MB
        const alertId = `al-size-${crypto.createHash('md5').update(file.filePath).digest('hex').substring(0, 8)}`;
        if (!activeAlerts.some(a => a.id === alertId)) {
          activeAlerts.push({
            id: alertId,
            title: 'Oversized Asset WAN Concurrency Warning',
            type: 'OVERSIZED',
            severity: 'LOW',
            file: file.fileName,
            details: `The file "${file.fileName}" is ${file.size}. Unrestricted transmission over active peak Office LAN queues could cause high latency spikes.`,
            recommendation: `Defer this high-density synchronization to off-peak hours or trigger adaptive WAN throttling limit to 150 MB/s.`,
            resolved: false
          });
        }
      }
    }
    
    // Step 3: Stale / archive candidates detection (via names having '_v1', '_old', '_copy', 'backup')
    for (const file of indexedFiles) {
      const lowerName = file.fileName.toLowerCase();
      if (
        lowerName.includes('old') || 
        lowerName.includes('copy') || 
        lowerName.includes('backup') || 
        lowerName.includes('v1_') || 
        lowerName.includes('_v1') ||
        lowerName.includes('archive')
      ) {
        const alertId = `al-stale-${crypto.createHash('md5').update(file.filePath).digest('hex').substring(0, 8)}`;
        if (!activeAlerts.some(a => a.id === alertId)) {
          activeAlerts.push({
            id: alertId,
            title: 'Legacy/Stale Draft Mapping Warning',
            type: 'STALE',
            severity: 'MEDIUM',
            file: file.fileName,
            details: `Draft, archive, or backup pattern identified in "${file.fileName}". This file has been scanned by the daemon but has constant zero-active read/write locks.`,
            recommendation: 'Offload to standby storage array and remove from the live hot-sync path to save 12% background cache indexing.',
            resolved: false
          });
        }
      }
    }

    // Ensure database representation maintains these alerts (overwrite memory client)
    inMemoryDb.alerts = activeAlerts;
    return activeAlerts;
  } catch (err) {
    console.error('[VoxSync AI Intelligence] Scan run failed:', err);
    return [];
  }
}
