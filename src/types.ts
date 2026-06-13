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
  id?: string;
  name: string;
  displayName?: string;
  aptPackages?: string;
  queryCommand?: string;
  description: string;
  category: string;
  installed: boolean;
  version: string | null;
  required?: boolean;
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
