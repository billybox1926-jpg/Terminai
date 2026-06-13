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
  name: string;
  description: string;
  category: string;
  installed: boolean;
  version: string | null;
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
