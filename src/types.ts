export interface SystemStats {
  cpu: {
    load: number;
    cores: number;
    model: string;
  };
  memory: {
    total: string;
    free: string;
    percent: number;
  };
  disk: {
    total: string;
    used: string;
    free: string;
    percent: string;
  };
  uptime: number;
  os: {
    type: string;
    release: string;
    platform: string;
  };
  cwd: string;
}

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  mtime: string;
}

export interface CLITool {
  id: string;
  name: string;
  displayName?: string;
  aptPackages?: string;
  termuxPackages?: string;
  queryCommand?: string;
  description: string;
  category: string;
  installed: boolean;
  version: string | null;
  required?: boolean;
  installByDefault?: boolean;
}

export interface TerminalLine {
  id: string;
  type: "command" | "stdout" | "stderr" | "info" | "success" | "error";
  text: string;
  cwd?: string;
  timestamp: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  lines: TerminalLine[];
  cwd: string;
  isActive: boolean;
}

export interface TermuxProperties {
  bell: "vibrate" | "beep" | "silent";
  cursorStyle: "block" | "underline" | "bar";
  fontSize: number;
  terminalTheme: "elegant-dark" | "gruvbox" | "solarized" | "cyberpunk" | "monokai" | "matrix";
}

export interface OptimizedCommandResult {
  optimizedCommand: string;
  explanation: string;
  alternative: string;
}

export interface PackageReadiness {
  total: number;
  installed: number;
  missing: number;
  ready: boolean;
}

export interface PackageListResponse {
  tools: CLITool[];
  readiness: PackageReadiness;
}

export interface RuntimeBootstrapStatus {
  packageManager: string;
  total: number;
  installed: number;
  missing: number;
  requiredMissing: number;
  runtimeReady: boolean;
  packages: CLITool[];
}

export interface RuntimeBootstrapResult {
  command: string | null;
  message: string;
  packageManager?: string;
  missingCount?: number;
  packages?: string[];
  installed?: boolean;
  healthy?: boolean;
}

export interface ApiCapability {
  id: string;
  displayName: string;
  category: string;
  description: string;
  permission: string;
  status: "simulated" | "available" | "unavailable";
  nativeRequired: boolean;
}

export interface ApiStatusResponse {
  capabilities: ApiCapability[];
  summary: {
    total: number;
    simulated: number;
    available: number;
    unavailable: number;
    nativeRequired: number;
    oneAppReady: boolean;
  };
}

export interface DeviceInfo {
  batteryLevel: number;
  batteryTemperature: string;
  isCharging: boolean;
  networkSsid: string;
  clipboard: string;
  systemSdk: number;
  manufacturer: string;
  brand: string;
  cpuArch: string;
  permissions: {
    camera: "granted" | "denied" | "prompt";
    gps: "granted" | "denied" | "prompt";
    microphone: "granted" | "denied" | "prompt";
    storage: "granted" | "denied" | "prompt";
  };
}

export interface TelemetryArtifactSpec {
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  buildProfile: string;
  targetAbis: string[];
  keystoreSigning: string;
  minSdkVersion: number;
  targetSdkVersion: number;
  artifactOutputName: string;
  lastCompileTimestamp: string;
}

export interface DeviceBuildData {
  telemetry: TelemetryArtifactSpec;
  device: DeviceInfo;
}

// ── API Bridge types ──────────────────────────────────────────────────

export interface ApiBridgeContract {
  bridgeName: string;
  bridgeVersion: string;
  apiManifest: string;
  defaultAdapter: string;
  futureNativeAdapter: string;
  invocationMode: string;
  permissionMode: string;
  auditLogFile: string;
  blockedCapabilities: string[];
}

export interface ApiBridgeStatus {
  contract: ApiBridgeContract | null;
  capabilities: ApiCapability[];
  adapter: string;
  total: number;
  available: number;
  simulated: number;
  unavailable: number;
  permissionRequired: number;
  auditLog: string;
}

export interface ApiInvokeRequest {
  capabilityId: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface ApiInvokeResponse {
  success: boolean;
  capabilityId: string;
  action: string;
  adapter: string;
  status: "ok" | "simulated" | "unavailable" | "blocked" | "error";
  data?: any;
  message: string;
  audited: boolean;
}

export interface ApiAuditEvent {
  timestamp: string;
  capabilityId: string;
  action: string;
  adapter: string;
  status: string;
  message: string;
}
