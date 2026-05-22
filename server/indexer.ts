import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface IndexedFileRecord {
  id: string;
  filePath: string;     // Relative path from sync_dir/
  fileName: string;     // Base name
  size: string;         // Human readable size
  sizeBytes: number;    // Absolute size in bytes
  checksum: string;     // SHA-256 hash representation
  department: string;   // Architectural department
  mtime: Date;          // Last modified date
  status: 'IN_SYNC' | 'MODIFIED' | 'LOCAL_ONLY';
}

const syncDir = path.resolve(process.cwd(), 'sync_dir');
let indexRegistry: IndexedFileRecord[] = [];

// Helper to match file extension to architecture departments
export function getDepartmentByExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.rvt':
      return 'Structural';
    case '.dwg':
      return 'Architecture';
    case '.max':
    case '.png':
    case '.jpg':
    case '.jpeg':
      return 'Renders/3D';
    case '.xlsx':
    case '.xls':
      return 'BOQ Estimations';
    default:
      return 'MEPF Engine';
  }
}

// Compute SHA-256 Checksum for a file using streaming (sandbox-friendly and memory efficient)
export function computeFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        resolve('N/A');
        return;
      }
      
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex').substring(0, 16));
      });
      
      stream.on('error', (err) => {
        console.error(`[VoxSync Indexer] Checksum streaming error for ${filePath}:`, err);
        // Fallback sync checksum if streaming fails
        try {
          const buffer = fs.readFileSync(filePath);
          resolve(crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16));
        } catch (e) {
          resolve('ERROR');
        }
      });
    } catch (e) {
      resolve('ERROR');
    }
  });
}

// Format byte size to MB/GB
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0.00 MB';
  const sizeMB = bytes / (1024 * 1024);
  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  }
  return `${sizeMB.toFixed(2)} MB`;
}

// Recursively walk directory up to Max Depth of 5 to avoid infinite loop sandbox issues
async function walkDirectory(dirPath: string, rootDir: string, depth = 0): Promise<string[]> {
  if (depth > 5) return [];
  let results: string[] = [];
  
  try {
    if (!fs.existsSync(dirPath)) return [];
    const list = fs.readdirSync(dirPath);
    
    for (const file of list) {
      // Avoid dotfiles, and standard heavy dependencies
      if (file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === '.vite') {
        continue;
      }
      
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat && stat.isDirectory()) {
        const subResults = await walkDirectory(fullPath, rootDir, depth + 1);
        results = results.concat(subResults);
      } else {
        results.push(fullPath);
      }
    }
  } catch (err) {
    console.error('[VoxSync Indexer] Walk directory error:', err);
  }
  
  return results;
}

// Run a complete index validation sweep
export async function runFilesystemIndexSweep(): Promise<IndexedFileRecord[]> {
  console.log('[VoxSync Indexer] Initializing comprehensive physical file indexing sweep...');
  
  // Ensure sync_dir exists
  if (!fs.existsSync(syncDir)) {
    try {
      fs.mkdirSync(syncDir, { recursive: true });
    } catch (err) {
      console.error('[VoxSync Indexer] Failed to construct sync_dir folder:', err);
      return [];
    }
  }
  
  const allFiles = await walkDirectory(syncDir, syncDir);
  const nextRegistry: IndexedFileRecord[] = [];
  
  for (const filePath of allFiles) {
    try {
      const relativePath = path.relative(syncDir, filePath);
      const filename = path.basename(filePath);
      const stats = fs.statSync(filePath);
      const checksum = await computeFileChecksum(filePath);
      const department = getDepartmentByExt(filename);
      const sizeStr = formatBytes(stats.size);
      
      nextRegistry.push({
        id: `idx-file-${crypto.createHash('md5').update(relativePath).digest('hex').substring(0, 10)}`,
        filePath: relativePath,
        fileName: filename,
        size: sizeStr,
        sizeBytes: stats.size,
        checksum,
        department,
        mtime: stats.mtime,
        status: 'IN_SYNC' // Managed as baseline state
      });
    } catch (err) {
      console.error(`[VoxSync Indexer] Failed indexing file entry: ${filePath}`, err);
    }
  }
  
  indexRegistry = nextRegistry;
  console.log(`[VoxSync Indexer] Sweep complete. Successfully indexed ${indexRegistry.length} assets.`);
  return indexRegistry;
}

// Retrieve the in-memory metadata cache registry list
export function getIndexedFiles(): IndexedFileRecord[] {
  return indexRegistry;
}
