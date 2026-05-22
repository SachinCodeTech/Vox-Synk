import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FolderGit2,
  HardDrive,
  Laptop,
  Layers,
  LayoutDashboard,
  Network,
  Play,
  RefreshCw,
  Server,
  Settings,
  Terminal,
  Trash2,
  Zap,
  Hourglass,
  Plus,
  Check,
  Shield,
  FileText,
  ChevronRight,
  Minimize2,
  Info,
  ArrowUpRight,
  CloudLightning,
  Archive,
  Compass,
  AlertCircle,
  Clock,
  Sliders,
  UserCheck,
  Power,
  Search,
  Wifi,
  FileCode,
  CheckCircle
} from 'lucide-react';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface Device {
  id: string;
  hostname: string;
  ip: string;
  location: string;
  role: string;
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING';
  storageUsed: number; // in GB
  storageTotal: number; // in GB
  latency: number; // in ms
  lastSeen: string;
  activeTransfers?: number;
  lastHeartbeat?: number;
  healthScore?: number;
  uptimeSeconds?: number;
}

interface SyncJob {
  id: string;
  fileName: string;
  size: string;
  sourceDevice: string;
  destDevice: string;
  progress: number; // 0 to 100
  speed: string; // e.g. "142.5 MB/s"
  type: 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION';
  status: 'QUEUED' | 'SYNCING' | 'COMPLETED' | 'FAILED' | 'VERIFYING' | 'TRANSFERRING' | 'VALIDATING';
  department: string;
  eta: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  deviceId: string;
  message: string;
}

interface Project {
  id: string;
  name: string;
  code: string;
  departments: { name: string; size: string; count: number; active: boolean }[];
  status: string;
}

interface AIAleart {
  id: string;
  title: string;
  type: 'DUPLICATE' | 'STALE' | 'OVERSIZED' | 'CONFLICT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  details: string;
  recommendation: string;
  resolved: boolean;
}

// ==========================================
// UNIQUE ID GENERATOR
// ==========================================
let globalCounter = 0;
function generateUniqueId(prefix: string): string {
  globalCounter += 1;
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now()}-${globalCounter}-${rand}`;
}

// ==========================================
// UPTIME FORMATTER UTILITY
// ==========================================
function formatUptimeDuration(seconds?: number): string {
  if (!seconds || seconds === 0) return 'Just started';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  } else if (m > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}

// ==========================================
// CLUSTER TOPOLOGY MAP COMPONENT (STAGE 3D)
// ==========================================
function ClusterTopologyMap({ devices, syncJobs }: { devices: Device[]; syncJobs: SyncJob[] }) {
  const width = 600;
  const height = 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 220; // horizontal radius
  const vRadius = 60;  // vertical radius for beautiful clean oval layout

  const baseNodes = devices.map((dev, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, devices.length) - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + vRadius * Math.sin(angle);
    return {
      ...dev,
      x,
      y
    };
  });

  const activeLinks = syncJobs
    .filter(j => j.status === 'SYNCING')
    .map(job => {
      const srcNode = baseNodes.find(n => n.hostname === job.sourceDevice);
      const destNode = baseNodes.find(n => n.hostname === job.destDevice);
      if (srcNode && destNode) {
        return {
          id: job.id,
          fileName: job.fileName,
          srcX: srcNode.x,
          srcY: srcNode.y,
          destX: destNode.x,
          destY: destNode.y,
          speed: job.speed
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ id: string; fileName: string; srcX: number; srcY: number; destX: number; destY: number; speed: string }>;

  return (
    <div className="bg-[#121824]/50 border border-[#1f2937] rounded-2xl p-5 space-y-4 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-sm font-semibold text-white tracking-tight">Virtual Cluster Mesh Topology & Direct-WAN Traces</h2>
        </div>
        <div className="text-[10px] font-mono text-slate-400 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
          {activeLinks.length} Active Replication Links
        </div>
      </div>

      <div className="relative w-full bg-slate-950 p-3 border border-slate-850 rounded-xl overflow-x-auto select-none scrollbar-thin scrollbar-thumb-slate-800">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto min-w-[550px] max-h-[180px] block"
        >
          {/* Defs for gradients / glowing filters */}
          <defs>
            <radialGradient id="meshGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.1" />
            </radialGradient>
            <linearGradient id="linkActiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Central coordination area background shading */}
          <ellipse cx={centerX} cy={centerY} rx={radius} ry={vRadius} fill="url(#meshGradient)" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 4" />

          {/* Draw Mesh Connection Lines (passive structural backplane) */}
          {baseNodes.map((n1, i) => 
            baseNodes.slice(i + 1).map((n2, j) => {
              const isDirectActive = activeLinks.some(l => 
                (l.srcX === n1.x && l.srcY === n1.y && l.destX === n2.x && l.destY === n2.y) ||
                (l.srcX === n2.x && l.srcY === n2.y && l.destX === n1.x && l.destY === n1.y)
              );
              if (isDirectActive) return null; // Drawn separately in higher contrast!
              return (
                <line
                  key={`mesh-link-${i}-${j}`}
                  x1={n1.x}
                  y1={n1.y}
                  x2={n2.x}
                  y2={n2.y}
                  stroke="#1e293b"
                  strokeWidth="1.2"
                  strokeOpacity="0.55"
                />
              );
            })
          )}

          {/* Draw Active Sync Links with Sliding Pulse Indicator */}
          {activeLinks.map((link) => (
            <g key={`active-${link.id}`}>
              {/* Core active thread */}
              <line
                x1={link.srcX}
                y1={link.srcY}
                x2={link.destX}
                y2={link.destY}
                stroke="url(#linkActiveGrad)"
                strokeWidth="2"
                className="animate-pulse"
              />
              {/* Flowing data particle */}
              <circle r="4.5" fill="#22d3ee">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path={`M ${link.srcX} ${link.srcY} L ${link.destX} ${link.destY}`}
                />
              </circle>
              {/* Dynamic text floating */}
              <text
                x={(link.srcX + link.destX) / 2}
                y={(link.srcY + link.destY) / 2 - 6}
                fill="#22d3ee"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                className="bg-slate-950 px-1 rounded"
              >
                {link.fileName.length > 20 ? link.fileName.slice(0, 17) + '...' : link.fileName}
              </text>
            </g>
          ))}

          {/* Render Cluster Nodes */}
          {baseNodes.map((node) => {
            const isOnline = node.status !== 'OFFLINE';
            const isSyncing = node.status === 'SYNCING';
            const nodeColor = isSyncing ? '#22d3ee' : isOnline ? '#10b981' : '#475569';
            const outlineColor = isSyncing ? '#06b6d4' : isOnline ? '#059669' : '#334155';

            return (
              <g key={`node-${node.id}`} className="group">
                {/* Node hover glow disk */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="16"
                  fill={nodeColor}
                  fillOpacity="0.04"
                  stroke={outlineColor}
                  strokeWidth="1"
                  strokeOpacity="0.15"
                  className="transition duration-300 group-hover:scale-125"
                />
                
                {/* Visual pulse for syncing hosts */}
                {isSyncing && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="12"
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                    className="animate-ping"
                    opacity="0.3"
                  />
                )}

                {/* Node center point */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="6.5"
                  fill="#030712"
                  stroke={nodeColor}
                  strokeWidth="2.5"
                />

                {/* Text Labels */}
                <text
                  x={node.x}
                  y={node.y - 12}
                  fill="#f1f5f9"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {node.hostname}
                </text>
                <text
                  x={node.x}
                  y={node.y + 16}
                  fill={isOnline ? "#94a3b8" : "#64748b"}
                  fontSize="6.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {isOnline ? `${node.latency}ms / ${node.healthScore || 100} HS` : 'OFFLINE'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function App() {
  // Navigation & View Status
  const [activeTab, setActiveTab] = useState<'dashboard' | 'devices' | 'projects' | 'queue' | 'ai' | 'logs' | 'settings'>('dashboard');
  
  // Real-time Global Toggles / Simulation State
  const [isSimulating, setIsSimulating] = useState(true);
  const [wanBpsLimit, setWanBpsLimit] = useState<number>(500); // MB/s
  const [lanDirect, setLanDirect] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [integrityScore, setIntegrityScore] = useState(100.0);
  
  // Modal / Controls State
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceHost, setNewDeviceHost] = useState('');
  const [newDeviceIP, setNewDeviceIP] = useState('');
  const [newDeviceLoc, setNewDeviceLoc] = useState('NYC Head Office');
  const [newDeviceRole, setNewDeviceRole] = useState('Workspace Node');
  
  // Sync Conflict State Sim
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedConflictRes, setSelectedConflictRes] = useState<'server' | 'client' | 'both'>('server');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT'>('ALL');

  // AI Audit State
  const [isAuditScanning, setIsAuditScanning] = useState(false);
  const [auditComplete, setAuditComplete] = useState(false);

  // Full-Stack backend sync indicators
  const [activeBackendActive, setActiveBackendActive] = useState(false);
  const [activeCacheEngine, setActiveCacheEngine] = useState('Memory Cache');

  // PWA Support state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    // Check if app is launched in standalone display mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[VoxSync Core] Progressive app installed successfully.');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };


  // ==========================================
  // INITIALIZERS FOR SEED DATA
  // ==========================================

  // Devices Seed State
  const [devices, setDevices] = useState<Device[]>([
    { id: 'dev-1', hostname: 'NYC-ARCH-DESK-01', ip: '10.240.10.31', location: 'New York (LAN)', role: 'Lead Architect Workstation', status: 'SYNCING', storageUsed: 384, storageTotal: 1000, latency: 4, lastSeen: 'Just now', activeTransfers: 1, lastHeartbeat: Date.now(), healthScore: 98, uptimeSeconds: 32050 },
    { id: 'dev-2', hostname: 'LDN-MEPF-SRV-02', ip: '10.240.20.12', location: 'London WAN', role: 'Central MEP Engineering Vault', status: 'SYNCING', storageUsed: 2240, storageTotal: 8000, latency: 14, lastSeen: 'Just now', activeTransfers: 2, lastHeartbeat: Date.now(), healthScore: 95, uptimeSeconds: 154200 },
    { id: 'dev-3', hostname: 'SGP-BOQ-STUDIO-05', ip: '10.245.40.8', location: 'Singapore WAN', role: 'BOQ Estimations Server', status: 'ONLINE', storageUsed: 120, storageTotal: 500, latency: 38, lastSeen: '2m ago', activeTransfers: 1, lastHeartbeat: Date.now() - 4000, healthScore: 91, uptimeSeconds: 8400 },
    { id: 'dev-4', hostname: 'PAR-STR-DESK-11', ip: '10.240.30.45', location: 'Paris LAN', role: 'Structural Modeling Node', status: 'ONLINE', storageUsed: 412, storageTotal: 1000, latency: 8, lastSeen: '1m ago', activeTransfers: 0, lastHeartbeat: Date.now() - 2000, healthScore: 99, uptimeSeconds: 41200 },
    { id: 'dev-5', hostname: 'TYO-VRT-RENDER-03', ip: '10.198.80.99', location: 'Tokyo WAN', role: 'GPU Render Farm Coordinator', status: 'OFFLINE', storageUsed: 6200, storageTotal: 12000, latency: 154, lastSeen: '3h ago', activeTransfers: 0, lastHeartbeat: Date.now() - 3600000, healthScore: 0, uptimeSeconds: 0 }
  ]);

  // Projects Seed State
  const [projects, setProjects] = useState<Project[]>([
    {
      id: 'proj-alpha',
      name: 'Project Alpha (Waterfront Tower)',
      code: 'PA-2026',
      status: 'Active Synchronization',
      departments: [
        { name: 'Architecture (AR)', size: '242.4 GB', count: 1845, active: true },
        { name: 'Structural (ST)', size: '98.1 GB', count: 412, active: true },
        { name: 'MEPF Engine (MP)', size: '154.0 GB', count: 284, active: true },
        { name: 'Renders/3D (RD)', size: '840.4 GB', count: 96, active: false }
      ]
    },
    {
      id: 'proj-beta',
      name: 'Project Beta (Intl Transit Hub)',
      code: 'PB-HUB',
      status: 'Selective Replication',
      departments: [
        { name: 'Architecture (AR)', size: '1.2 TB', count: 4890, active: true },
        { name: 'Structural (ST)', size: '890.3 GB', count: 1912, active: true },
        { name: 'MEPF Engine (MP)', size: '2.1 TB', count: 3410, active: true },
        { name: 'BOQ Estimations (BQ)', size: '15.4 GB', count: 88, active: true }
      ]
    },
    {
      id: 'proj-gamma',
      name: 'Project Gamma (Ecological Resort)',
      code: 'PG-ECO',
      status: 'Optimized Sync Mode',
      departments: [
        { name: 'Architecture (AR)', size: '84.3 GB', count: 912, active: true },
        { name: 'Structural (ST)', size: '12.4 GB', count: 85, active: false },
        { name: 'Renders/3D (RD)', size: '194.2 GB', count: 54, active: true }
      ]
    }
  ]);

  // Active Sync Jobs
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([
    { id: 'job-1', fileName: 'foundation_detail_v6.rvt', size: '142.4 MB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'LDN-MEPF-SRV-02', progress: 54, speed: '142.5 MB/s', type: 'REPLICATION', status: 'SYNCING', department: 'Structural', eta: '12s' },
    { id: 'job-2', fileName: 'mep_layout_basement.dwg', size: '18.9 MB', sourceDevice: 'LDN-MEPF-SRV-02', destDevice: 'NYC-ARCH-DESK-01', progress: 32, speed: '18.4 MB/s', type: 'DOWNLOAD', status: 'SYNCING', department: 'MEPF Engine', eta: '4s' },
    { id: 'job-3', fileName: 'boq_estimate_rev2.xlsx', size: '4.2 MB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'SGP-BOQ-STUDIO-05', progress: 85, speed: '2.8 MB/s', type: 'UPLOAD', status: 'SYNCING', department: 'BOQ Estimations', eta: '1s' },
    { id: 'job-4', fileName: 'lobby_atrium_cycles.max', size: '1.4 GB', sourceDevice: 'NYC-ARCH-DESK-01', destDevice: 'PAR-STR-DESK-11', progress: 0, speed: '0.0 MB/s', type: 'REPLICATION', status: 'QUEUED', department: 'Renders/3D', eta: 'Waiting' },
    { id: 'job-5', fileName: 'structural_girder_loads.pdf', size: '8.4 MB', sourceDevice: 'PAR-STR-DESK-11', destDevice: 'LDN-MEPF-SRV-02', progress: 100, speed: '48.9 MB/s', type: 'UPLOAD', status: 'COMPLETED', department: 'Structural', eta: 'Finished' },
  ]);

  // AI Insights Seed
  const [aiAlerts, setAiAlerts] = useState<AIAleart[]>([
    { id: 'al-1', title: 'Stale Folder Active Sync Mapping', type: 'STALE', severity: 'MEDIUM', file: '/ProjectAlpha/BOQ/2025_estimates_old/', details: 'This folder containing 18 XLS files hasn\'t changed for 124 days, yet it continues to execute heartbeat validation hooks every 5 minutes across WAN nodes.', recommendation: 'Move to VoxZip Archiver and map to standby cloud storage to save 4% overhead.', resolved: false },
    { id: 'al-2', title: 'Duplicate CAD Drafting Files Found', type: 'DUPLICATE', severity: 'HIGH', file: 'mep_layout_basement(Copy).dwg', details: 'Identical SHA-256 binary hash detected in NY-Node & LDN-Server under different structural file namespaces.', recommendation: 'Execute auto-consolidate to match baseline and keep latest file references.', resolved: false },
    { id: 'al-3', title: 'Oversized Asset WAN Delay Suggestion', type: 'OVERSIZED', severity: 'LOW', file: 'highres_atrium_panoramic_360.png', details: 'File size is 4.8 GB. Direct WAN upload mapped from New York to Singapore Office is choking workstation network pipes.', recommendation: 'Defer the synchronization of Renders background files to off-peak hours (after 19:00 local time) via Sync Scheduling Rule.', resolved: false },
  ]);

  // Log History State
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 'log-1', timestamp: '10:39:01', level: 'INFO', deviceId: 'NYC-ARCH-DESK-01', message: 'Established TLS 1.3 socket layer with Paris workstation PAR-STR-DESK-11.' },
    { id: 'log-2', timestamp: '10:39:03', level: 'SUCCESS', deviceId: 'LDN-MEPF-SRV-02', message: 'Verified SHA-256 block-data integrity check for model "foundation_detail_v6.rvt" chunk 14.' },
    { id: 'log-3', timestamp: '10:39:05', level: 'INFO', deviceId: 'SGP-BOQ-STUDIO-05', message: 'Heartbeat validated. Calculated WAN optimization ratio: 4.1x compression active.' },
    { id: 'log-4', timestamp: '10:39:06', level: 'ALERT', deviceId: 'NYC-ARCH-DESK-01', message: 'Detected active concurrency conflict on: /PB-HUB/ST/structural_layout.rvt. Machine LDN-MEPF-SRV-02 holds draft locks.' },
    { id: 'log-5', timestamp: '10:39:08', level: 'WARNING', deviceId: 'TYO-VRT-RENDER-03', message: 'Server ping check timed out over Tokyo Node WAN pipeline. Marking local instance OFFLINE.' },
    { id: 'log-6', timestamp: '10:39:10', level: 'SUCCESS', deviceId: 'NYC-ARCH-DESK-01', message: 'Simulated LAN Direct peer discovery matched NYC-ARCH-DESK-01 with 10.240.10.31.' }
  ]);

  // Synchronize state values to refs so the simulation loop can access current values safely
  const syncJobsRef = useRef(syncJobs);
  const logsRef = useRef(logs);
  const devicesRef = useRef(devices);

  useEffect(() => {
    syncJobsRef.current = syncJobs;
  }, [syncJobs]);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  // ==========================================
  // FULL-STACK BACKED/API SOCKET BINDER (REALTIME EFFECT)
  // ==========================================
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let reconnectAttempts = 0;
    const maxReconnectDelay = 10000;

    function connectWS() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Clean up previous socket cleanly if exists
      if (ws) {
        try {
          ws.onopen = null;
          ws.onclose = null;
          ws.onerror = null;
          ws.onmessage = null;
          ws.close();
        } catch (e) {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-sync`;
      console.log(`[VoxSync Admin] Connecting Socket to host: ${wsUrl} (Attempt: ${reconnectAttempts + 1})`);
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[VoxSync Admin] WebSockets socket connected!');
        setActiveBackendActive(true);
        reconnectAttempts = 0; // reset attempts
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'INITIAL_STATE' || payload.type === 'STATE_UPDATE') {
            const { devices: rxDevs, syncJobs: rxJobs, logs: rxLogs, alerts: rxAlerts, isSimulating: rxSim, cacheEngineUsed } = payload.data;
            if (rxDevs) setDevices(rxDevs);
            if (rxJobs) setSyncJobs(rxJobs);
            if (rxLogs) setLogs(rxLogs);
            if (rxAlerts) setAiAlerts(rxAlerts);
            if (rxSim !== undefined) setIsSimulating(rxSim);
            if (cacheEngineUsed) setActiveCacheEngine(cacheEngineUsed);
          } else if (payload.type === 'CONFLICT_TRIGGERED') {
            setShowConflictModal(true);
          } else if (payload.type === 'FS_CHANGE') {
            const { event: fsEvent, filename } = payload.data;
            console.log(`[VoxSync Watcher Notification] chokidar trigger: ${fsEvent} on file: ${filename}`);
          }
        } catch (e) {
          console.error('[VoxSync WS Exception]', e);
        }
      };

      ws.onclose = () => {
        setActiveBackendActive(false);
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), maxReconnectDelay) + Math.random() * 500;
        reconnectAttempts++;
        console.warn(`[VoxSync Admin] Sockets disconnected. Attempting reconnect #${reconnectAttempts} in ${Math.round(delay)}ms...`);
        reconnectTimeout = setTimeout(connectWS, delay);
      };

      ws.onerror = (err) => {
        console.error('[VoxSync Admin] WebSocket encountered trace error. Recycled closed handles.', err);
        try {
          ws?.close();
        } catch (e) {}
      };
    }

    connectWS();

    // Resilient state polling fallback to keep UI fully in sync with real server if WebSockets fail/upgrade blocked
    let pollInterval: any = null;
    
    function startPollingFallback() {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        // Query real server DB state
        fetch('/api/state')
          .then(res => {
            if (!res.ok) throw new Error('API down');
            return res.json();
          })
          .then(payload => {
            // Once polling succeeds, we know the backend is active and responding
            setActiveBackendActive(true);
            
            const { devices: rxDevs, syncJobs: rxJobs, logs: rxLogs, alerts: rxAlerts, isSimulating: rxSim, cacheEngineUsed } = payload;
            if (rxDevs) setDevices(rxDevs);
            if (rxJobs) setSyncJobs(rxJobs);
            if (rxLogs) setLogs(rxLogs);
            if (rxAlerts) setAiAlerts(rxAlerts);
            if (rxSim !== undefined) setIsSimulating(rxSim);
            if (cacheEngineUsed) setActiveCacheEngine(cacheEngineUsed);
          })
          .catch((e) => {
            console.debug('[VoxSync Polling] API unreachable, relying on local simulations', e);
          });
      }, 3000);
    }
    
    startPollingFallback();

    // Query server configuration for caching parameters
    fetch('/api/health')
      .then(res => res.json())
      .then(d => {
        setActiveBackendActive(true);
        if (d.services?.cache) {
          const cacheVal = d.services.cache;
          setActiveCacheEngine(typeof cacheVal === 'object' ? cacheVal.type : cacheVal);
        }
      })
      .catch(() => {
        console.log('[VoxSync Admin] Control Node is not listening. Engaging isolated local state UI dashboard.');
      });

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // ==========================================
  // REAL-TIME LOCAL SIMULATOR LOOP (STANDALONE FALLBACK MODE)
  // ==========================================
  useEffect(() => {
    // If backend socket communication is online, fully defer to centralized server loops!
    if (!isSimulating || activeBackendActive) return;

    const interval = setInterval(() => {
      // 1. Progress active sync jobs
      const currentJobs = syncJobsRef.current;
      const logsToAdd: LogEntry[] = [];
      let jobsUpdated = false;

      const nextJobs = currentJobs.map((job): SyncJob => {
        if (job.status === 'SYNCING') {
          jobsUpdated = true;
          const step = Math.floor(Math.random() * 8) + 4; // increment random 4-12%
          const nextProgress = Math.min(job.progress + step, 100);
          
          // Randomly update speed slightly for realism
          const rawSpeed = parseFloat(job.speed);
          const fluctuation = (Math.random() * 10 - 5);
          const nextSpeed = job.type === 'UPLOAD' 
            ? (Math.max(2.0, Number((2.8 + fluctuation * 0.1).toFixed(1)))) 
            : (Math.max(10.0, Number((142.5 + fluctuation).toFixed(1))));

          if (nextProgress === 100) {
            // Trigger log event for success
            const now = new Date().toLocaleTimeString();
            const formattedTime = now.split(' ')[0];
            
            logsToAdd.push({
              id: generateUniqueId('log-gen'),
              timestamp: formattedTime,
              level: 'SUCCESS',
              deviceId: job.sourceDevice,
              message: `Replicating complete: "${job.fileName}" successfully written to destination node ${job.destDevice}. Integrity Verified.`
            });
            
            return { ...job, progress: 100, speed: '0.0 MB/s', status: 'COMPLETED', eta: 'Finished' };
          }
          
          // Recalculate remaining placeholder time
          const etaVal = nextProgress > 90 ? '1s' : nextProgress > 70 ? '4s' : nextProgress > 40 ? '11s' : '24s';
          
          return {
            ...job,
            progress: nextProgress,
            speed: `${nextSpeed} MB/s`,
            eta: etaVal
          };
        }
        return job;
      });

      // 2. Randomly restart completed/queued job loop for endless feel
      const activeCount = nextJobs.filter(j => j.status === 'SYNCING').length;
      let finalJobs = nextJobs;
      if (activeCount === 0) {
        // Restart jobs
        const filesPool = [
          { name: 'hvac_simulation_test.dwg', size: '44.8 MB', dept: 'MEPF Engine', type: 'DOWNLOAD' as 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION', source: 'LDN-MEPF-SRV-02', dest: 'NYC-ARCH-DESK-01' },
          { name: 'exterior_glass_render_4k.png', size: '189.2 MB', dept: 'Renders/3D', type: 'UPLOAD' as 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION', source: 'NYC-ARCH-DESK-01', dest: 'PAR-STR-DESK-11' },
          { name: 'seismic_calc_sheet_rev3.xls', size: '1.2 MB', dept: 'Structural', type: 'REPLICATION' as 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION', source: 'PAR-STR-DESK-11', dest: 'NYC-ARCH-DESK-01' },
          { name: 'boq_bento_tower_v4.xlsx', size: '12.4 MB', dept: 'BOQ Estimations', type: 'UPLOAD' as 'UPLOAD' | 'DOWNLOAD' | 'REPLICATION', source: 'NYC-ARCH-DESK-01', dest: 'SGP-BOQ-STUDIO-05' }
        ];
        
        const indexToInfect = Math.floor(Math.random() * filesPool.length);
        const selFile = filesPool[indexToInfect];

        finalJobs = [
          {
            id: generateUniqueId('job-gen'),
            fileName: selFile.name,
            size: selFile.size,
            sourceDevice: selFile.source,
            destDevice: selFile.dest,
            progress: 0,
            speed: selFile.type === 'UPLOAD' ? '2.5 MB/s' : '135.2 MB/s',
            status: 'SYNCING' as const,
            type: selFile.type,
            department: selFile.dept,
            eta: '18s'
          },
          ...nextJobs.filter(j => j.id !== 'job-5').slice(0, 4) // cap queue length
        ];
        jobsUpdated = true;
      }

      if (jobsUpdated) {
        setSyncJobs(finalJobs);
      }

      // 3. Fluctuate Latencies of devices
      const currentDevs = devicesRef.current;
      const nextDevs = currentDevs.map(d => {
        if (d.status === 'OFFLINE') return d;
        const bounce = Math.floor(Math.random() * 4 - 2);
        const newLatency = Math.max(1, d.latency + bounce);
        return { ...d, latency: newLatency };
      });
      setDevices(nextDevs);

      // 4. Randomize status log spikes slightly
      if (Math.random() > 0.75) {
        const events = [
          { level: 'INFO' as const, msg: 'Chokidar watcher scanned folder hierarchy in 12ms. Zero physical modifications reported.' },
          { level: 'INFO' as const, msg: 'Active storage integrity verify triggered. SHA checksums match distributed cluster ledger.' },
          { level: 'SUCCESS' as const, msg: 'Completed WAN-Direct connection bridge validation to Singapore BOQ coordinator.' },
          { level: 'WARNING' as const, msg: 'WAN jitter spike detected over NY-London routing tunnel. Throttling compression levels gracefully.' }
        ];
        const randomEvObj = events[Math.floor(Math.random() * events.length)];
        const now = new Date().toLocaleTimeString();
        const formattedTime = now.split(' ')[0];

        logsToAdd.push({
          id: generateUniqueId('log-noise'),
          timestamp: formattedTime,
          level: randomEvObj.level,
          deviceId: 'COLLABORATIVE-GRID',
          message: randomEvObj.msg
        });
      }

      if (logsToAdd.length > 0) {
        setLogs(prevLogs => [...logsToAdd, ...prevLogs].slice(0, 40));
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, activeBackendActive]);

  // ==========================================
  // CLICK HANDLERS & INJECTORS (DYNAMIC REST APIs)
  // ==========================================

  // Toggle Project Department syncing activity rules
  const toggleProjectDept = (projectId: string, deptName: string) => {
    setProjects(prevProjs => prevProjs.map(p => {
      if (p.id === projectId) {
        const updatedDepts = p.departments.map(d => {
          if (d.name === deptName) {
            const nextActive = !d.active;
            
            // Logger trigger
            const now = new Date().toLocaleTimeString().split(' ')[0];
            setLogs(prev => [
              {
                id: generateUniqueId('log-toggle'),
                timestamp: now,
                level: nextActive ? 'SUCCESS' : 'WARNING',
                deviceId: 'POLICY-SERVER',
                message: `Sync directive updated: Department "${deptName}" in ${p.name} is now ${nextActive ? 'ACTIVE (Real-time tracking)' : 'SUSPENDED (Local storage offline)'}`
              },
              ...prev
            ]);

            return { ...d, active: nextActive };
          }
          return d;
        });
        return { ...p, departments: updatedDepts };
      }
      return p;
    }));
  };

  // Inject a simulated client file change manually
  const injectLocalFileChange = async (dept: string, specFile?: string) => {
    const defaultFiles: Record<string, string[]> = {
      'Architecture': ['concept_atrium_plan_v2.dwg', 'elevations_scheme_west.dwg', 'facade_glass_system.rvt'],
      'Structural': ['load_bearings_bento.rvt', 'column_schedule_tower.dwg', 'structural_anchors.rvt'],
      'MEPF Engine': ['electrical_layout_level3.dwg', 'chiller_vent_details.dwg', 'hvac_ducts_plenums.dwg'],
      'BOQ Estimations': ['boq_raw_summary_steel.xlsx', 'tender_quote_envelope_a.xlsx'],
      'Renders/3D': ['atrium_materials_v1.max', 'sunset_view_final_cycles.png']
    };

    const files = defaultFiles[dept] || ['unnamed_architectural_asset.dwg'];
    const chosenFile = specFile || files[Math.floor(Math.random() * files.length)];
    const sizeStr = `${(Math.random() * 45 + 5).toFixed(1)} MB`;

    if (activeBackendActive) {
      try {
        const response = await fetch('/api/sync_jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: chosenFile, department: dept, size: sizeStr })
        });
        if (response.ok) {
          setActiveTab('queue');
          return;
        }
      } catch (e) {
        console.warn('[VoxSync API Fallback] /api/sync_jobs is unreachable. Running local simulation inject.', e);
      }
    }

    // Local execution fallback
    const newJob: SyncJob = {
      id: generateUniqueId('job-inject'),
      fileName: chosenFile,
      size: sizeStr,
      sourceDevice: 'NYC-ARCH-DESK-01',
      destDevice: 'LDN-MEPF-SRV-02',
      progress: 0,
      speed: '124.8 MB/s',
      type: 'UPLOAD',
      status: 'SYNCING',
      department: dept,
      eta: '4s'
    };

    setSyncJobs(prev => [newJob, ...prev]);

    const now = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [
      {
        id: generateUniqueId('log-inject-evt'),
        timestamp: now,
        level: 'ALERT',
        deviceId: 'NYC-ARCH-DESK-01',
        message: `[FileSystem Watcher] Detected modification on "${chosenFile}" inside ${dept} directory. Calculated binary diff size: ${sizeStr}. Queueing transfer.`
      },
      ...prev
    ]);

    setActiveTab('queue');
  };

  // Trigger Conflict Simulation
  const triggerSyncConflict = async () => {
    if (activeBackendActive) {
      try {
        const response = await fetch('/api/simulation/conflict', { method: 'POST' });
        if (response.ok) return;
      } catch (e) {
        console.warn('[VoxSync API Fallback] Failed to push conflict update. Deploying UI triggers manually.', e);
      }
    }

    setShowConflictModal(true);
    const now = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [
      {
        id: generateUniqueId('log-conf-trigger'),
        timestamp: now,
        level: 'ALERT',
        deviceId: 'NYC-ARCH-DESK-01',
        message: `💥 Distributed write-conflict detected! Device "LDN-MEPF-SRV-02" and workstation "NYC-ARCH-DESK-01" modified "load_bearings_bento.rvt" concurrently.`
      },
      ...prev
    ]);
  };

  // Resolve Conflict action
  const resolveConflict = async (strategy: 'server' | 'client' | 'both') => {
    setSelectedConflictRes(strategy);
    setShowConflictModal(false);
    
    if (activeBackendActive) {
      try {
        const response = await fetch('/api/simulation/resolve-conflict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy })
        });
        if (response.ok) return;
      } catch (e) {
        console.warn('[VoxSync API Fallback] Failed to notify backend of strategy resolution:', e);
      }
    }

    // Inject solution into log (standalone)
    const now = new Date().toLocaleTimeString().split(' ')[0];
    let resolutionMessage = '';
    if (strategy === 'server') {
      resolutionMessage = 'Approved Server lock (LDN-MEPF-SRV-02 version). Discarded local transient copy.';
    } else if (strategy === 'client') {
      resolutionMessage = 'Forced client workstation version (NYC-ARCH-DESK-01). Overwrote central cloud node with rollback snapshot created.';
    } else {
      resolutionMessage = 'Maintained dual-node branches: Renamed NYC workstation version to "load_bearings_bento_NYC-CONFLICT_REV.rvt". Both synced.';
      injectLocalFileChange('Structural', 'load_bearings_bento_NYC-CONFLICT_REV.rvt');
    }

    setLogs(prev => [
      {
        id: generateUniqueId('log-conf-res'),
        timestamp: now,
        level: 'SUCCESS',
        deviceId: 'COLLABORATIVE-GRID',
        message: `Conflict RESOLVED via interactive policy: ${resolutionMessage}`
      },
      ...prev
    ]);
  };

  // Register device action
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceHost || !newDeviceIP) return;

    if (activeBackendActive) {
      try {
        const response = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostname: newDeviceHost,
            ip: newDeviceIP,
            location: newDeviceLoc,
            role: newDeviceRole
          })
        });
        if (response.ok) {
          setNewDeviceHost('');
          setNewDeviceIP('');
          setShowAddDevice(false);
          return;
        }
      } catch (e) {
        console.warn('[VoxSync API Fallback] Core register offline. Standard offline enrollment mapping active.', e);
      }
    }

    const newDev: Device = {
      id: generateUniqueId('dev'),
      hostname: newDeviceHost.toUpperCase().replace(/\s+/g, '-'),
      ip: newDeviceIP,
      location: newDeviceLoc,
      role: newDeviceRole,
      status: 'ONLINE',
      storageUsed: 0,
      storageTotal: 1000,
      latency: Math.floor(Math.random() * 25) + 3,
      lastSeen: 'Just registered'
    };

    setDevices(prev => [...prev, newDev]);

    // Push connection log
    const now = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [
      {
        id: generateUniqueId('log-reg'),
        timestamp: now,
        level: 'SUCCESS',
        deviceId: newDev.hostname,
        message: `Device configuration successfully registered. Token generated. Device established secure handshake protocol.`
      },
      ...prev
    ]);

    // Reset form states
    setNewDeviceHost('');
    setNewDeviceIP('');
    setShowAddDevice(false);
  };

  // Trigger AI Audit Scan Process
  const triggerAIAuditScan = () => {
    setIsAuditScanning(true);
    setAuditComplete(false);
    
    setTimeout(() => {
      setIsAuditScanning(false);
      setAuditComplete(true);
      // Boost integrity score simulated
      setIntegrityScore(100);

      const now = new Date().toLocaleTimeString().split(' ')[0];
      setLogs(prev => [
        {
          id: generateUniqueId('log-audit'),
          timestamp: now,
          level: 'SUCCESS',
          deviceId: 'VOX-AI-INTELLIGENCE',
          message: `Comprehensive directory file check structural audit completed. Identified zero unauthorized lockouts.`
        },
        ...prev
      ]);
    }, 2500);
  };

  const resolveAlertSim = async (id: string) => {
    if (activeBackendActive) {
      try {
        const response = await fetch('/api/alerts/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (response.ok) return;
      } catch (e) {
        console.warn('[VoxSync API Fallback] Failed resolving alert on backend. Splicing offline backup mutation.', e);
      }
    }

    setAiAlerts(prev => prev.map(al => {
      if (al.id === id) {
        return { ...al, resolved: true };
      }
      return al;
    }));

    const now = new Date().toLocaleTimeString().split(' ')[0];
    setLogs(prev => [
      {
        id: generateUniqueId('log-alert-res'),
        timestamp: now,
        level: 'SUCCESS',
        deviceId: 'VOX-AI-INTELLIGENCE',
        message: `Action enacted to resolve risk warning: System applied configuration to isolate corresponding dataset.`
      },
      ...prev
    ]);
  };

  // Calculate current active bandwidth speed
  const activeBandwidthUsed = useMemo(() => {
    const activeJobs = syncJobs.filter(j => j.status === 'SYNCING');
    if (activeJobs.length === 0) return 0;
    
    const sum = activeJobs.reduce((acc, job) => {
      const val = parseFloat(job.speed);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return Number(sum.toFixed(1));
  }, [syncJobs]);


  // Filtering functions for logs and search queries
  const processedLogs = useMemo(() => {
    return logs.filter(l => {
      const matchQuery = l.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         l.deviceId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = logFilter === 'ALL' || l.level === logFilter;
      return matchQuery && matchFilter;
    });
  }, [logs, searchQuery, logFilter]);


  return (
    <div id="voxsync-app-container" className="min-h-screen text-slate-100 bg-[#0a0c10] flex flex-row overflow-hidden font-sans">
      
      {/* ==========================================
          LEFT NAVIGATION RAIL & BRANDING
          ========================================== */}
      <aside id="voxsync-nav-rail" className="w-64 bg-[#0d1117] border-r border-[#1f2937] flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-[#1f2937] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-[#1d4ed8]/30 border border-[#2563eb] rounded-lg text-[#3b82f6] shadow-md shadow-[#2563eb]/10">
                <Layers className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold tracking-tight text-white text-base">VOXSYNC</h1>
                <p className="text-[10px] text-slate-400 font-mono tracking-wider">PHASE 1 SIM V1.2</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute"></span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 relative"></span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5 text-[#3b82f6]" />
              <span>Infra Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('devices')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'devices'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <Server className="w-4.5 h-4.5 text-indigo-400" />
              <span>Device Orchestrator</span>
              <span className="ml-auto text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-indigo-400 font-mono">
                {devices.filter(d => d.status === 'ONLINE' || d.status === 'SYNCING').length}/{devices.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'projects'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <FolderGit2 className="w-4.5 h-4.5 text-emerald-400" />
              <div className="flex flex-col text-left">
                <span>Selective Sync Rules</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'queue'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4.5 h-4.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Active Sync Queue</span>
              <span className="ml-auto text-[10px] bg-cyan-950/40 border border-cyan-800/50 px-1.5 py-0.5 rounded text-cyan-400 font-mono">
                {syncJobs.filter(j => j.status === 'SYNCING').length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'ai'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <CloudLightning className="w-4.5 h-4.5 text-amber-400" />
              <span>AI Sync Intelligence</span>
              {aiAlerts.filter(a => !a.resolved).length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'logs'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4.5 h-4.5 text-purple-400" />
              <span>Activity Terminal</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-800 text-white shadow-inner border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4.5 h-4.5 text-slate-400" />
              <span>System Settings</span>
            </button>
          </nav>
        </div>

        {/* Sync Status Sidebar Footer Accent */}
        <div className="p-4 mx-4 mb-6 bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="flex items-center space-x-2.5 mb-1.5">
            <Database className="w-4.5 h-4.5 text-blue-400" />
            <span className="text-xs font-semibold text-slate-200">Cache Pool: <span className="text-indigo-400 font-mono">{typeof activeCacheEngine === 'object' && activeCacheEngine !== null ? (activeCacheEngine as any).type || JSON.stringify(activeCacheEngine) : activeCacheEngine}</span></span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full" style={{ width: '64%' }}></div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>6.4 TB Used</span>
            <span>{activeBackendActive ? 'Postgres Active' : 'Offline Pool'}</span>
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN AREA CONTENT (CONTAINER)
          ========================================== */}
      <main id="voxsync-content-area" className="flex-1 flex flex-col min-w-0 bg-[#0f141c]">
        
        {/* TOP STATUS BAR & SIMULATOR CONTROLS */}
        <header id="voxsync-header-controls" className="h-16 border-b border-[#1f2937] px-6 bg-[#0c1017] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeBackendActive ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span className={`font-mono font-semibold tracking-wider ${activeBackendActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {activeBackendActive ? 'SECURE CONSOLE SYSTEM LIVE' : 'STANDBY OFFLINE EMBEDDED'}
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>COORDINATION CLUSTERS: 4/5 READY</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Engine Status Controller */}
            <div className="flex items-center space-x-2.5">
              <span className="text-xs text-slate-400 select-none hidden lg:inline">Active Replication Thread:</span>
              <button 
                onClick={() => {
                  setIsSimulating(!isSimulating);
                  const now = new Date().toLocaleTimeString().split(' ')[0];
                  setLogs(prev => [
                    {
                      id: `log-toggle-sim-${Date.now()}`,
                      timestamp: now,
                      level: 'WARNING',
                      deviceId: 'SIMULATION-CONTROLLER',
                      message: `Synchronization background thread simulation loop has been ${!isSimulating ? 'STARTED' : 'PAUSED'}. Live filesystem listeners active.`
                    },
                    ...prev
                  ]);
                }}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  isSimulating 
                    ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/30' 
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isSimulating ? 'ACTIVE' : 'STANDBY'}</span>
              </button>
            </div>

            {/* Test action triggers */}
            <div className="flex items-center space-x-2">
              {/* PWA Install Action Prompt */}
              {deferredPrompt && (
                <button
                  onClick={handlePwaInstall}
                  className="text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/80 hover:bg-cyan-900/40 px-3 py-1.5 rounded-lg transition-all animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.15)] flex items-center space-x-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Install App</span>
                </button>
              )}
              {isInstalled && (
                <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-emerald-400 font-mono tracking-wider">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>DESKTOP APP ACTIVE</span>
                </div>
              )}

              <button 
                onClick={triggerSyncConflict}
                className="text-xs font-medium text-amber-400 bg-amber-950/30 border border-amber-900/60 hover:bg-amber-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inject Conflict</span>
              </button>
              
              <button 
                onClick={() => injectLocalFileChange('Architecture')}
                className="text-xs font-medium text-blue-400 bg-blue-950/30 border border-blue-900/60 hover:bg-blue-900/40 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>File Mod Event</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTAINER VIEWPORTS */}
        <section className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* TAB 1: DASHBOARD INFRASTRUCTURE OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div id="voxsync-dashboard-tab" className="space-y-6 animate-fade-in">
              
              {/* Stat Rails Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-[#121824]/80 border border-[#1f2937]/80 rounded-xl p-5 shadow-sm hover:border-[#3b82f6]/40 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 tracking-wide">ACTIVE SYNC BANDWIDTH</span>
                    <Zap className="w-4.5 h-4.5 text-cyan-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {isSimulating ? activeBandwidthUsed : 0}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium">MB/s</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    WAN throttling capped at <span className="font-mono text-[#3b82f6]">{wanBpsLimit} MB/s</span>
                  </p>
                </div>

                <div className="bg-[#121824]/80 border border-[#1f2937]/80 rounded-xl p-5 shadow-sm hover:border-[#3b82f6]/40 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 tracking-wide">INTEGRITY MATRIX SCORE</span>
                    <Shield className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {integrityScore.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Distributed ledger active • Checked: <span className="text-emerald-400 font-medium">10,214 files</span>
                  </p>
                </div>

                <div className="bg-[#121824]/80 border border-[#1f2937]/80 rounded-xl p-5 shadow-sm hover:border-[#3b82f6]/40 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 tracking-wide">LAN DIRECT BYPASS RATIO</span>
                    <Wifi className="w-4.5 h-4.5 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold tracking-tight text-indigo-400 font-mono">82.4%</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Direct local transfers saved <span className="text-indigo-400 font-mono font-semibold">142.4 GB</span> bandwidth
                  </p>
                </div>

                <div className="bg-[#121824]/80 border border-[#1f2937]/80 rounded-xl p-5 shadow-sm hover:border-[#3b82f6]/40 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 tracking-wide">ACTIVE DIRECTORIES</span>
                    <FolderGit2 className="w-4.5 h-4.5 text-[#3b82f6]" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">3 Projects</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Selective sync active across <span className="text-[#3b82f6] font-medium">11 departments</span>
                  </p>
                </div>

              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Grid Item 1: Active Transfers */}
                <div className="lg:col-span-2 bg-[#121824]/50 backdrop-blur-md border border-[#1f2937] rounded-xl flex flex-col overflow-hidden">
                  <div className="p-5 border-b border-[#1f2937] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Zap className="w-4.5 h-4.5 text-cyan-400" />
                      <h2 className="text-sm font-semibold text-white tracking-tight">Active Real-Time Transfer Pipelines</h2>
                    </div>
                    <span className="text-[10px] bg-[#1d4ed8]/20 border border-[#2563eb]/30 text-[#3b82f6] px-2 py-0.5 rounded font-mono font-medium uppercase tracking-wider animate-pulse">
                      Simulated Active IO
                    </span>
                  </div>

                  <div className="p-6 space-y-5 flex-1 justify-center">
                    {syncJobs.filter(j => j.status === 'SYNCING').length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        <CheckCircle2 className="w-8 h-8 text-slate-700 mb-2.5" />
                        <span className="text-xs">No active transfers inside processing pipelines</span>
                        <button 
                          onClick={() => injectLocalFileChange('Architecture')}
                          className="text-xs font-semibold text-[#3b82f6] underline hover:text-blue-400 mt-1.5"
                        >
                          Trigger Simulated CAD File Change Events
                        </button>
                      </div>
                    ) : (
                      syncJobs.filter(j => j.status === 'SYNCING').map((job) => (
                        <div key={job.id} className="bg-slate-900/80 p-4 border border-slate-850 rounded-xl space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                            <div className="flex items-center space-x-3.5 mb-2 sm:mb-0">
                              <div className="p-2 bg-slate-800 border border-slate-700 rounded text-cyan-400 font-mono text-xs">
                                {job.fileName.slice(-4).toUpperCase()}
                              </div>
                              <div>
                                <h3 className="text-xs font-semibold text-slate-100 tracking-tight block sm:inline">{job.fileName}</h3>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono pt-0.5">
                                  <span>{job.size}</span>
                                  <span>•</span>
                                  <span className="text-[#3b82f6] font-medium">{job.department}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 sm:text-right">
                              <span className="text-xs font-mono font-bold text-cyan-400">{job.speed}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-850 px-2 py-0.5 rounded font-mono border border-slate-800">
                                ETA {job.eta}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div 
                                className="bg-gradient-to-r from-cyan-500 to-[#1d4ed8] h-1.5 rounded-full transition-all duration-300" 
                                style={{ width: `${job.progress}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                              <div className="flex items-center space-x-1 text-[10px]">
                                <span className="font-semibold text-slate-200">{job.sourceDevice}</span>
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-300">{job.destDevice}</span>
                              </div>
                              <span>{job.progress}% synced</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Grid Item 2: AI Predictive System & Insights */}
                <div className="bg-[#121824]/50 backdrop-blur-md border border-[#1f2937] rounded-xl flex flex-col justify-between overflow-hidden">
                  <div className="p-5 border-b border-[#1f2937] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CloudLightning className="w-4.5 h-4.5 text-amber-400" />
                      <h2 className="text-sm font-semibold text-white tracking-tight">AI Sync Intelligence Insights</h2>
                    </div>
                    <button 
                      onClick={() => setActiveTab('ai')}
                      className="text-[10px] font-semibold text-[#3b82f6] hover:underline"
                    >
                      Audit
                    </button>
                  </div>

                  <div className="p-5 space-y-4 flex-1">
                    {aiAlerts.filter(a => !a.resolved).map((alert) => (
                      <div key={alert.id} className="relative p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-2 hover:border-slate-700 transition">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase ${
                            alert.severity === 'HIGH' 
                              ? 'bg-rose-950/40 text-rose-400 border-rose-900/60' 
                              : alert.severity === 'MEDIUM' 
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' 
                              : 'bg-blue-950/40 text-blue-400 border-blue-900/60'
                          }`}>
                            {alert.type} • {alert.severity} Risk
                          </span>
                          <button
                            onClick={() => resolveAlertSim(alert.id)}
                            className="text-[10px] font-medium text-[#3b82f6] hover:text-blue-400 flex items-center space-x-1 bg-slate-850 border border-slate-800 px-1.5 py-0.5 rounded"
                          >
                            <Check className="w-3 h-3" />
                            <span>Resolve</span>
                          </button>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{alert.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-1 truncate">{alert.file}</p>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">{alert.recommendation}</p>
                        </div>
                      </div>
                    ))}
                    
                    {aiAlerts.filter(a => !a.resolved).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1 py-12">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mb-1" />
                        <span className="text-slate-400 font-semibold text-xs">Directory Score Optimal</span>
                        <span className="text-[10px] text-slate-500 text-center">Zero duplicate references found!</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Grid Section: Device Clusters & Terminal Log Combined */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Device Standby Column */}
                <div className="bg-[#121824]/50 border border-[#1f2937] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Server className="w-4.5 h-4.5 text-indigo-400" />
                      <h2 className="text-sm font-semibold text-white tracking-tight">Active Edge-Server Clusters</h2>
                    </div>
                    <button 
                      onClick={() => setActiveTab('devices')}
                      className="text-xs font-semibold text-[#3b82f6] hover:underline"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="space-y-3">
                    {devices.map((dev) => (
                      <div key={dev.id} className="p-3 bg-slate-900 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 bg-slate-850 border border-slate-800 rounded-lg ${
                            dev.status === 'OFFLINE' ? 'text-slate-500' : 'text-indigo-400'
                          }`}>
                            <Laptop className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-slate-200 font-mono tracking-tight">{dev.hostname}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                dev.status === 'SYNCING' ? 'bg-cyan-400 animate-ping' : dev.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'
                              }`}></span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">{dev.location} • {dev.ip}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono text-[10px]">
                          <span className="text-slate-300 font-semibold block">{Math.round((dev.storageUsed / dev.storageTotal) * 100)}% Used</span>
                          <span className="text-slate-500 block">{dev.latency}ms ping</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual Terminal Log Box */}
                <div className="bg-[#121824]/50 border border-[#1f2937] rounded-xl p-5 flex flex-col h-[340px]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2.5">
                      <Terminal className="w-4.5 h-4.5 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white tracking-tight">Handshake Event logs FEED</h2>
                    </div>
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className="p-1 bg-slate-850 hover:bg-slate-800 rounded text-slate-400 border border-slate-800"
                      title="Open full page logs"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Feed container */}
                  <div className="flex-1 overflow-y-auto bg-slate-950 p-4 border border-slate-850 rounded-xl font-mono text-[10px] space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
                    {logs.slice(0, 15).map((log) => (
                      <div key={log.id} className="flex items-start space-x-2 border-b border-slate-900 pb-1.5 last:border-0">
                        <span className="text-slate-500 leading-none shrink-0">{log.timestamp}</span>
                        <span className={`font-bold uppercase tracking-wide leading-none text-[8px] px-1 rounded shrink-0 ${
                          log.level === 'SUCCESS' 
                            ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-900/50' 
                            : log.level === 'ALERT' 
                            ? 'text-rose-400 bg-rose-950/30 border border-rose-900/50' 
                            : log.level === 'WARNING' 
                            ? 'text-amber-400 bg-amber-950/30 border border-amber-900/50' 
                            : 'text-blue-400 bg-blue-950/30 border border-blue-900/50'
                        }`}>
                          {log.level}
                        </span>
                        <span className="text-slate-400 shrink-0 select-none">[{log.deviceId}]</span>
                        <span className="text-slate-300 break-all leading-normal">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: DEVICE ORCHESTRATION LAYER */}
          {activeTab === 'devices' && (
            <div id="voxsync-devices-tab" className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Edge-Server Cluster Orchestrator</h2>
                  <p className="text-xs text-slate-400 pr-4 mt-0.5">Configure authentication handshakes, view storage matrix quotas and force latency triggers.</p>
                </div>
                <button
                  onClick={() => setShowAddDevice(true)}
                  className="bg-[#2563eb] text-white hover:bg-blue-600 font-medium text-xs px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 self-start sm:self-auto shadow-lg shadow-blue-900/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Workspace Node</span>
                </button>
              </div>

              {/* Add Device Dialog (simulated modal) */}
              {showAddDevice && (
                <form onSubmit={handleAddDevice} className="bg-slate-900 border border-[#3b82f6]/40 p-5 rounded-2xl animate-scale-up space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#2563eb]"></div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase select-none">NODE TOKEN REGISTRATION</h3>
                    <button 
                      type="button"
                      onClick={() => setShowAddDevice(false)}
                      className="text-slate-400 hover:text-slate-250 font-semibold text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Node Hostname</label>
                      <input 
                        type="text" 
                        placeholder="e.g. SF-ARCH-DESK-09" 
                        value={newDeviceHost}
                        onChange={(e) => setNewDeviceHost(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Virtual IP</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 10.245.80.24" 
                        value={newDeviceIP}
                        onChange={(e) => setNewDeviceIP(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 block uppercase font-bold">WAN Location</label>
                      <select 
                        value={newDeviceLoc}
                        onChange={(e) => setNewDeviceLoc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option>New York Office (LAN)</option>
                        <option>London Office (WAN)</option>
                        <option>Singapore Hub (WAN)</option>
                        <option>Paris Studio (LAN)</option>
                        <option>Tokyo Render (WAN)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-slate-400 block uppercase font-bold">Role Profile ID</label>
                      <select 
                        value={newDeviceRole}
                        onChange={(e) => setNewDeviceRole(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 flex-1"
                      >
                        <option>Workspace Node Master</option>
                        <option>Central Engineering Vault</option>
                        <option>Estimations Node</option>
                        <option>Edge Storage Cache</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button 
                      type="submit"
                      className="bg-[#2563eb] text-white hover:bg-blue-600 font-semibold text-xs px-4 py-2 rounded-lg"
                    >
                      Authenticate Register Node
                    </button>
                  </div>
                </form>
              )}

              <ClusterTopologyMap devices={devices} syncJobs={syncJobs} />

              {/* Devices Grid Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {devices.map((dev) => (
                  <div key={dev.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden shadow duration-200 flex flex-col justify-between">
                    
                    {/* Header */}
                    <div className="p-5 border-b border-slate-850 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-slate-850 border border-slate-800 text-indigo-400 rounded-lg">
                          <Laptop className={`w-4.5 h-4.5 ${dev.status === 'SYNCING' && 'animate-spin'}`} style={{ animationDuration: '4s' }} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold font-mono text-slate-100">{dev.hostname}</h3>
                          <p className="text-[9px] text-slate-400 tracking-wider font-semibold font-mono uppercase">{dev.ip}</p>
                        </div>
                      </div>

                      <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase flex items-center space-x-1 ${
                        dev.status === 'SYNCING' 
                          ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60' 
                          : dev.status === 'ONLINE' 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60' 
                          : 'bg-slate-950 text-slate-500 border-slate-850'
                      }`}>
                        <span className={`w-1 h-1 rounded-full mr-1 ${
                          dev.status === 'SYNCING' ? 'bg-cyan-400 animate-pulse' : dev.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}></span>
                        <span>{dev.status}</span>
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-5 space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <span className="text-slate-500 block uppercase font-mono text-[9px] font-bold">DEPARTMENT/ROLE</span>
                          <span className="text-slate-350 text-xs font-semibold">{dev.role}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase font-mono text-[9px] font-bold">WAN NODE POSITION</span>
                          <span className="text-slate-350 text-xs font-semibold">{dev.location}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-500 block uppercase font-mono text-[9px] font-bold">HEALTH MONITOR</span>
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 mt-0.5 rounded text-[10px] font-mono font-bold border ${
                            dev.status === 'OFFLINE'
                              ? 'text-slate-500 bg-slate-950/40 border-slate-900/60'
                              : (dev.healthScore || 100) >= 90
                              ? 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40'
                              : (dev.healthScore || 100) >= 70
                              ? 'text-amber-400 bg-amber-950/20 border-amber-900/40'
                              : 'text-rose-400 bg-rose-950/20 border-rose-900/40'
                          }`}>
                            <span>{(dev.status === 'OFFLINE' ? 0 : (dev.healthScore || 100))}% HSE</span>
                            <span className="text-slate-500 font-normal">({dev.activeTransfers || 0} active)</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase font-mono text-[9px] font-bold">OPERATING UPTIME</span>
                          <span className="text-slate-350 text-xs font-mono font-semibold block mt-0.5">
                            {formatUptimeDuration(dev.status === 'OFFLINE' ? 0 : dev.uptimeSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Storage Bar Indicator */}
                      <div className="space-y-1.5 bg-slate-950/40 p-3.5 border border-slate-850 rounded-xl">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                            <span>Storage Allocation:</span>
                          </span>
                          <span className="font-bold text-slate-300">
                            {dev.storageUsed} GB / {dev.storageTotal} GB
                          </span>
                        </div>
                        <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.round((dev.storageUsed / dev.storageTotal) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>{Math.round((dev.storageUsed / dev.storageTotal) * 100)}% active allocation value</span>
                          <span>{dev.storageTotal - dev.storageUsed} GB free</span>
                        </div>
                      </div>

                    </div>

                    {/* Quick Trigger Actions */}
                    <div className="px-5 py-4 bg-slate-950 border-t border-slate-850 flex items-center justify-between text-xs select-none">
                      <div className="flex items-center space-x-1.5 text-slate-500 font-mono text-[10px]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Seen {dev.lastSeen}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => {
                            if (dev.status === 'OFFLINE') return;
                            const now = new Date().toLocaleTimeString().split(' ')[0];
                            setLogs(prev => [
                              {
                                id: `log-ping-${Date.now()}`,
                                timestamp: now,
                                level: 'INFO',
                                deviceId: dev.hostname,
                                message: `Manually executed WAN handshake verification ping tool towards ${dev.ip}. Returned in: ${dev.latency}ms. Connection stable.`
                              },
                              ...prev
                            ]);
                          }}
                          disabled={dev.status === 'OFFLINE'}
                          className="px-2.5 py-1 text-[10px] font-mono bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded hover:text-white transition duration-150 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          Ping latency ({dev.latency}ms)
                        </button>

                        <button 
                          onClick={async () => {
                            if (activeBackendActive) {
                              try {
                                await fetch(`/api/devices/${dev.id}/toggle`, { method: 'POST' });
                                return;
                              } catch (e) {
                                console.warn('[VoxSync API Fallback] Failed to toggle node state on live server, executing local state toggle.', e);
                              }
                            }
                            setDevices(prev => prev.map(d => {
                              if (d.id === dev.id) {
                                const nextStatus = d.status === 'OFFLINE' ? 'ONLINE' : 'OFFLINE';
                                
                                const now = new Date().toLocaleTimeString().split(' ')[0];
                                setLogs(prev => [
                                  {
                                    id: `log-toggle-power-${Date.now()}`,
                                    timestamp: now,
                                    level: nextStatus === 'ONLINE' ? 'SUCCESS' : 'WARNING',
                                    deviceId: d.hostname,
                                    message: `Administrative trigger: Server node has been set structurally ${nextStatus}.`
                                  },
                                  ...prev
                                ]);

                                return { 
                                  ...d, 
                                  status: nextStatus,
                                  latency: nextStatus === 'OFFLINE' ? 999 : Math.floor(Math.random() * 20 + 3)
                                };
                              }
                              return d;
                            }));
                          }}
                          className={`p-1 rounded border transition ${
                            dev.status === 'OFFLINE' 
                              ? 'text-emerald-500 bg-emerald-950/20 border-emerald-900/60' 
                              : 'text-rose-500 bg-rose-950/20 border-rose-900/60'
                          }`}
                          title={dev.status === 'OFFLINE' ? "Switch ONLINE" : "Force OFFLINE"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PROJECT-BASED RULES SELECTIVE SYNC */}
          {activeTab === 'projects' && (
            <div id="voxsync-projects-tab" className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Selective Multi-Branch Policy Mapping</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control synchronize directive locks, view directory size scopes, and assign selective filters for engineering branches.</p>
              </div>

              <div className="space-y-6">
                {projects.map((proj) => (
                  <div key={proj.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-4">
                    
                    {/* Project Header block */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-850 pb-4 gap-2">
                      <div className="flex items-center space-x-3.5">
                        <div className="p-2.5 bg-slate-850 border border-slate-800 rounded-lg text-emerald-400">
                          <FolderGit2 className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{proj.name}</h3>
                          <span className="text-[10px] text-slate-500 font-mono tracking-wider font-bold">PROJECT CONFIGURATION ID: {proj.code}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-xs font-mono">
                        <span className="text-slate-400">Active Mode:</span>
                        <span className="bg-slate-950 border border-slate-850 text-emerald-400 px-2.5 py-0.5 rounded font-medium">
                          {proj.status}
                        </span>
                      </div>
                    </div>

                    {/* Selective matrix rules header */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 select-none">DEPARTMENT sync directive rules:</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {proj.departments.map((dept) => (
                          <div 
                            key={dept.name} 
                            onClick={() => toggleProjectDept(proj.id, dept.name)}
                            className={`p-4 border rounded-xl select-none cursor-pointer transition flex flex-col justify-between ${
                              dept.active 
                                ? 'bg-slate-950 border-slate-700/80 hover:border-[#3b82f6]/60 text-slate-100' 
                                : 'bg-slate-950/40 border-slate-850/80 hover:border-slate-700 opacity-60 text-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-baseline mb-3">
                              <span className="text-xs font-semibold tracking-tight">{dept.name}</span>
                              <div className={`p-1 rounded-md text-[9px] font-mono leading-none border uppercase ${
                                dept.active 
                                  ? 'bg-[#1d4ed8]/20 border-[#2563eb]/20 text-[#3b82f6]' 
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}>
                                {dept.active ? 'ACTIVE' : 'OFFLINE'}
                              </div>
                            </div>

                            <div className="space-y-1.5 font-mono text-[10px]">
                              <div className="flex justify-between">
                                <span>Directory Size:</span>
                                <span className={`font-semibold ${dept.active ? 'text-slate-300' : 'text-slate-500'}`}>{dept.size}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tracked Assets:</span>
                                <span className={`font-semibold ${dept.active ? 'text-slate-300' : 'text-slate-500'}`}>{dept.count} units</span>
                              </div>
                            </div>

                            {/* Overlay check sign */}
                            <div className="flex items-center space-x-1 text-[9px] mt-3.5 pt-2 border-t border-slate-850 text-slate-400 font-mono">
                              {dept.active ? (
                                <span className="text-emerald-400 flex items-center space-x-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Simulate direct WAN sync</span>
                                </span>
                              ) : (
                                <span>Click to authorize and map path</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Department lock summary */}
                    <div className="bg-slate-950/50 p-4 border border-slate-850 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-xs gap-3">
                      <div className="flex items-center space-x-2.5 text-slate-400 leading-snug">
                        <Info className="w-4.5 h-[#3b82f6]" />
                        <span>Policy Directive auto-isolates structural revisions on LAN direct sync paths bypass when target WAN queue has chokes.</span>
                      </div>
                      
                      <button 
                        onClick={() => injectLocalFileChange('Architecture')}
                        className="text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 px-3.5 py-2 rounded-lg transition"
                      >
                        Push simulation file modified trigger
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: QUEUE CONTROL & DISPUTE MANAGER */}
          {activeTab === 'queue' && (
            <div id="voxsync-queue-tab" className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-baseline sm:justify-between gap-2 border-b border-slate-850 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Active Real-Time Transfer Pipelines</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Pause and resume specific stream blocks, manage parallel threads, and troubleshoot collision conflicts dynamically.</p>
                </div>
                
                <span className="text-[10px] text-slate-400 font-mono">
                  ACTIVE WAN PEERS: <span className="text-[#3b82f6] font-bold">3 CONNECTIONS</span>
                </span>
              </div>

              {/* Conflict banner trigger simulations */}
              <div className="bg-slate-900 border border-amber-900/60 p-5 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-amber-400">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                    <h3 className="text-sm font-semibold tracking-tight">Simulation Lock-Conflict Testing Center</h3>
                  </div>
                  <span className="text-[10px] bg-amber-950/40 text-amber-400 max-h-5 px-1.5 py-0.5 rounded border border-amber-900/40 uppercase font-mono tracking-wider font-bold">
                    Policy Engine Mode
                  </span>
                </div>
                
                <p className="text-xs text-slate-400 leading-normal max-w-3xl">
                  In master distributed repositories and real chokidar system folders, when multi-offices write files concurrently without direct server access, conflicts transpire. Test the resolution ruleset manually now:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={() => {
                      triggerSyncConflict();
                    }}
                    className="bg-amber-900/40 text-amber-300 border border-amber-800/80 hover:bg-amber-900/60 font-semibold text-xs px-4 py-2 rounded-lg transition"
                  >
                    🚀 Trigger Concurrent Write Conflict
                  </button>
                  <span className="text-xs text-slate-550 leading-none">Simulates lockouts on "load_bearings_bento.rvt"</span>
                </div>
              </div>

              {/* Active list stack view */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between font-mono text-[10px] text-slate-400 h-10 select-none">
                  <span>TRANSFER TARGET FILE PATH</span>
                  <div className="flex space-x-12 pr-6">
                    <span>PROGRESS STATUS</span>
                    <span className="hidden sm:inline w-20 text-right">BANDWIDTH</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-850">
                  {syncJobs.map((job) => (
                    <div key={job.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:bg-slate-850/10 transition">
                      
                      <div className="flex items-start space-x-3.5 mb-4 sm:mb-0">
                        <div className={`p-2.5 rounded-lg border font-mono text-xs text-center shrink-0 w-11 ${
                          job.status === 'COMPLETED' 
                            ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-400' 
                            : job.status === 'FAILED' 
                            ? 'bg-rose-950/20 border-rose-800/60 text-rose-400' 
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}>
                          {job.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-semibold text-slate-100 tracking-tight">{job.fileName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({job.size})</span>
                            <span className="text-[10px] bg-slate-850 border border-slate-800 text-slate-400 px-1.5 rounded font-mono">
                              {job.department}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-400 pt-1">
                            <span className="text-slate-300 font-semibold">{job.sourceDevice}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-slate-400">{job.destDevice}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right-aligned Progress indicator */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-12">
                        
                        <div className="w-full sm:w-48 space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                            <span className={`font-semibold capitalize ${
                              job.status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-300'
                            }`}>
                              {job.status.toLowerCase()}
                            </span>
                            <span>{job.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-850">
                            <div 
                              className={`h-1 rounded-full transition-all duration-300 ${
                                job.status === 'COMPLETED' 
                                  ? 'bg-emerald-500' 
                                  : job.status === 'FAILED' 
                                  ? 'bg-rose-500' 
                                  : 'bg-[#1d4ed8]'
                              }`} 
                              style={{ width: `${job.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col text-right font-mono text-[10px] w-20">
                          <span className="text-slate-200 font-semibold">{job.speed}</span>
                          <span className="text-slate-500 font-medium">{job.eta === 'Finished' ? 'Complete' : `ETA ${job.eta}`}</span>
                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI INSIGHTS AUDITING */}
          {activeTab === 'ai' && (
            <div id="voxsync-ai-tab" className="space-y-6 animate-fade-in text-slate-200">
              <div className="border-b border-slate-850 pb-4">
                <h2 className="text-lg font-bold text-white tracking-tight">AI Sync Intelligence Insights</h2>
                <p className="text-xs text-slate-400 mt-0.5">Isolate duplicate datasets, configure smart cloud off-loads, and evaluate predictive storage performance indexes.</p>
              </div>

              {/* Interactive Audit Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 relative">
                
                {/* Visual Radar scan container */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                  
                  {/* Circular Radar CSS element */}
                  <div className="flex flex-col items-center justify-center p-6 border-r border-[#1f2937]/50 lg:border-r">
                    <div className="relative w-40 h-40 rounded-full border border-[#3b82f6]/20 flex items-center justify-center overflow-hidden bg-slate-950">
                      
                      {/* Scanning sweeping light */}
                      {isAuditScanning && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#3b82f6]/0 via-[#3b82f6]/0 to-[#3b82f6]/20 animate-spin" style={{ animationDuration: '3s' }}></div>
                      )}

                      {/* Inside details */}
                      <div className="w-28 h-28 rounded-full border border-[#3b82f6]/10 flex flex-col items-center justify-center font-mono select-none relative bg-slate-900 z-10">
                        <Cpu className={`w-6 h-6 mb-1 ${isAuditScanning ? 'text-[#3b82f6] animate-pulse' : 'text-slate-500'}`} />
                        <span className="text-[9px] text-slate-500 font-bold">SHA AUDITOR</span>
                        <span className="text-xs font-bold text-slate-350">{isAuditScanning ? 'AUDITING...' : auditComplete ? 'OPTIMIZED' : 'IDLE STATE'}</span>
                      </div>
                    </div>

                    <button 
                      onClick={triggerAIAuditScan}
                      disabled={isAuditScanning}
                      className="mt-6 w-full max-w-sm bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-md hover:shadow-cyan-500/10 transition flex items-center justify-center space-x-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isAuditScanning && 'animate-spin'}`} />
                      <span>{isAuditScanning ? 'Enacting Directory Ledger Check...' : 'Trigger Full AI Sync Audit'}</span>
                    </button>
                  </div>

                  {/* Text descriptions */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-100 flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <span>Smart Multi-Node Redundancy Assessment</span>
                    </h3>
                    
                    <p className="text-xs text-slate-400 leading-normal">
                      The VoxSync predictive algorithm acts as a non-invasive daemon agent scanning chokidar-mapped directory states every calendar cycle. It detects identical model revision segments (SHA-256 binary validation) and alerts engineers when disk-swapping is optimal.
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-2 text-xs font-mono">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Integrity Status Checks</span>
                        <span className="text-emerald-400 font-bold">100.0% Perfect</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-[#1f2937]">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase">Unassigned Storage Space</span>
                        <span className="text-[#3b82f6] font-bold">+1.4 TB Reclaimable</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Anomaly alarms matrix */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-400 select-none">AI Anomaly Reports</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiAlerts.map((al) => (
                    <div 
                      key={al.id} 
                      className={`p-5 rounded-xl border space-y-3 relative overflow-hidden transition duration-150 ${
                        al.resolved 
                          ? 'bg-slate-900/40 border-slate-850/50 opacity-50' 
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      {al.resolved && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center font-mono text-xs font-semibold text-emerald-400 space-x-2 z-15">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>RESOLVED & ISOLATED</span>
                        </div>
                      )}

                      <div className="flex justify-between items-start">
                        <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase ${
                          al.severity === 'HIGH' 
                            ? 'bg-rose-950/40 text-rose-400 border-rose-900/60' 
                            : al.severity === 'MEDIUM' 
                            ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' 
                            : 'bg-blue-950/40 text-blue-400 border-blue-900/60'
                        }`}>
                          {al.type} Alert
                        </span>
                        
                        <button 
                          onClick={() => resolveAlertSim(al.id)}
                          className="text-[10px] font-semibold text-[#3b82f6] bg-slate-950 border border-slate-850 hover:bg-slate-850 px-2.5 py-1 rounded transition"
                        >
                          Enforce Resolution Option
                        </button>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">{al.title}</h4>
                        <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">{al.file}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{al.details}</p>
                      </div>

                      <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg text-xs">
                        <span className="font-semibold text-indigo-400 block pb-0.5 font-mono text-[9px] font-bold uppercase">AI RECOMMENDATION:</span>
                        <p className="text-slate-400 leading-normal text-[11px]">{al.recommendation}</p>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: SYSTEM LOGS TERMINAL FEED */}
          {activeTab === 'logs' && (
            <div id="voxsync-terminal-tab" className="space-y-6 animate-fade-in flex flex-col h-[600px] overflow-hidden">
              
              {/* Header options controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Active Infrastructure Handshake Terminal</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Read real-time chokidar folder changes, peer-connections, and checksum telemetry lines.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search log triggers..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-xs px-3.5 py-1.5 pl-8 rounded-lg text-white focus:outline-none"
                    />
                  </div>

                  <select 
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 text-xs py-1.5 px-3 rounded-lg text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">Severity: All Logs</option>
                    <option value="INFO">INFO ONLY</option>
                    <option value="SUCCESS">SUCCESS ONLY</option>
                    <option value="WARNING">WARNINGS ONLY</option>
                    <option value="ALERT">ALERTS ONLY</option>
                  </select>

                  <button 
                    onClick={() => {
                      setLogs([]);
                      const now = new Date().toLocaleTimeString().split(' ')[0];
                      setLogs([{ id: 'log-clear', timestamp: now, level: 'INFO', deviceId: 'POLICY-SERVER', message: 'Handshake event stream buffer cleared administratively.' }]);
                    }}
                    className="bg-slate-900 border border-slate-800 text-xs py-1.5 px-3 rounded-lg text-slate-300 hover:text-white transition"
                  >
                    Clear Feed
                  </button>
                </div>
              </div>

              {/* Console Window */}
              <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-850 rounded-xl p-5 font-mono text-xs text-slate-300 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
                {processedLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs">
                    -- No logs match current search criteria or severity filters --
                  </div>
                ) : (
                  processedLogs.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3.5 border-b border-slate-950 pb-2 hover:bg-slate-900/10 transition leading-relaxed">
                      
                      {/* Left time counter block */}
                      <span className="text-slate-500 shrink-0 select-none bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                        {log.timestamp}
                      </span>

                      {/* Pill alert type indicators */}
                      <span className={`text-[8px] font-bold font-mono px-1.5 rounded uppercase py-0.5 shrink-0 ${
                        log.level === 'SUCCESS' 
                          ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30' 
                          : log.level === 'ALERT' 
                          ? 'text-rose-400 bg-rose-950/20 border border-rose-900/30' 
                          : log.level === 'WARNING' 
                          ? 'text-amber-400 bg-amber-950/20 border border-amber-900/30' 
                          : 'text-blue-400 bg-blue-950/20 border border-blue-900/30'
                      }`}>
                        {log.level}
                      </span>

                      <span className="text-indigo-400 shrink-0 select-none">
                        [{log.deviceId}]
                      </span>

                      <p className="text-slate-300 select-all font-mono tracking-tight text-[11px] break-all">
                        {log.message}
                      </p>

                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* TAB 7: ENGINE SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div id="voxsync-settings-tab" className="space-y-6 animate-fade-in max-w-4xl">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">System Infrastructure Configuration</h2>
                <p className="text-xs text-slate-400 mt-0.5">Control replication bandwidth caps, Direct LAN discovery subnets, and alert thresholds.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-850 overflow-hidden">
                
                {/* Setting block 1 */}
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <h3 className="font-semibold text-slate-100">Global WAN Bandwidth Throttle</h3>
                      <p className="text-[11px] text-slate-400 pr-4">Limits synchronization transfer speed when nodes utilize public internet tunnels (WAN Paths).</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850 shrink-0">
                      Capped: {wanBpsLimit} MB/s
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="1000" 
                    step="50"
                    value={wanBpsLimit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setWanBpsLimit(val);
                      fetch('/api/settings/wan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ limit: val })
                      }).catch((err) => console.debug('[Settings Sync Error]', err));
                    }}
                    className="w-full bg-slate-950 rounded-lg cursor-pointer accent-[#3b82f6] h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>10 MB/s Minimal WAN Link</span>
                    <span>1,000 MB/s Full Fiber Sync Bypass</span>
                  </div>
                </div>

                {/* Setting block 2 */}
                <div className="p-5 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Direct-LAN Peer-to-Peer Bypass</h3>
                    <p className="text-xs text-slate-400 pr-5 mt-0.5">When machines reside within identical IP subnets, bypass WAN upload pipes completely and transfer blocks over local network direct connections at high gigabit speeds.</p>
                  </div>
                  <button 
                    onClick={() => setLanDirect(!lanDirect)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                      lanDirect ? 'bg-indigo-600 justify-end' : 'bg-slate-950 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Setting block 3 */}
                <div className="p-5 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Intelligent Active LZMA Multi-Compression</h3>
                    <p className="text-xs text-slate-400 pr-5 mt-0.5">Compress DWG and RVT block metrics prior to WAN transmission. Reduces physical transfer sizes by up to 5x on massive architectural metadata sheets at the expense of slight node CPU overhead.</p>
                  </div>
                  <button 
                    onClick={() => setCompressionEnabled(!compressionEnabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
                      compressionEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-950 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-md"></span>
                  </button>
                </div>

                {/* Setting block 4 */}
                <div className="p-5 flex items-center justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Enforce Distributed SHA-256 Ledger Validation</h3>
                    <p className="text-xs text-slate-400 pr-5 mt-0.5">Force all nodes to calculate local chunk validation checksum hashes. Guarantees 100% zero corruption rate during peak transmission periods across distributed global repositories.</p>
                  </div>
                  <div className="flex items-center space-x-1 font-mono text-emerald-400 text-xs bg-emerald-950/20 border border-emerald-900/60 font-semibold px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>LOCKED MANDATORY</span>
                  </div>
                </div>

              </div>
            </div>
          )}

        </section>

      </main>

      {/* ==========================================
          SYNC CONFLICT MODAL / CONCURRENT CONFLICTS
          ========================================== */}
      {showConflictModal && (
        <div id="voxsync-conflict-overlay" className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="bg-slate-900 border border-amber-900/60 rounded-2xl w-full max-w-xl shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>

            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
                <h3 className="text-base font-bold tracking-tight">Active Hash-Conflict Collision Resolved Lock</h3>
              </div>

              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 font-mono text-[11px] text-slate-400 text-left">
                <div className="flex justify-between border-b border-slate-900 pb-1.5">
                  <span>Resource Name:</span>
                  <span className="font-bold text-slate-150">/PB-HUB/ST/load_bearings_bento.rvt</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-1.5 text-xs text-slate-350">
                  <span className="text-xs font-semibold text-rose-400">Branch NYC workstation v2:</span>
                  <span>MD5 Hash: a9b4f2c... • 142.4 MB • 4m ago</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-0.5 text-xs text-slate-350">
                  <span className="text-xs font-semibold text-[#3b82f6]">Branch LDN server central v3:</span>
                  <span>MD5 Hash: 22fb74d... • 142.5 MB • 2m ago</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-normal">
                Choose the priority resolve strategy to reconcile machine states across the distributed directory ledger queue:
              </p>

              <div className="space-y-2.5">
                <button 
                  onClick={() => resolveConflict('server')}
                  className="w-full text-left p-3.5 bg-slate-950 border border-slate-850 hover:border-[#3b82f6] rounded-xl flex items-center justify-between transition"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Use Central LDN Server (v3 Central File)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Keeps London server copy. NYC workstation discards local changes with snapshot backup.</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button 
                  onClick={() => resolveConflict('client')}
                  className="w-full text-left p-3.5 bg-slate-950 border border-slate-850 hover:border-emerald-500 rounded-xl flex items-center justify-between transition"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Use NYC Workstation (v2 Workstation Draft)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Keeps NY workstation copy. Overwrites central server node file across cluster network.</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button 
                  onClick={() => resolveConflict('both')}
                  className="w-full text-left p-3.5 bg-slate-950 border border-slate-850 hover:border-amber-500 rounded-xl flex items-center justify-between transition"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Keep Duplicate Branches & Sync Both (Rename)</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Keeps both. NYC version renamed to "load_bearings_bento_NYC-CONFLICT_REV.rvt" & synced.</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="flex justify-end pt-3">
                <button 
                  onClick={() => setShowConflictModal(false)}
                  className="text-xs font-semibold text-slate-450 hover:text-slate-350 pr-2"
                >
                  Close Modal
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
