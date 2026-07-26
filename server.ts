import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec, execFile, spawn } from "child_process";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

// Initialize express app
const app = express();
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.TERMINAI_BIND_ADDRESS ?? "127.0.0.1";
const COMMAND_TIMEOUT_MS = Number.parseInt(process.env.TERMINAI_COMMAND_TIMEOUT_MS ?? "30000", 10);
const COMMAND_MAX_BUFFER = Number.parseInt(process.env.TERMINAI_COMMAND_MAX_BUFFER ?? "1048576", 10);

function getCommandTimeoutMs(): number {
  const envTimeout = Number.parseInt(process.env.TERMINAI_COMMAND_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : COMMAND_TIMEOUT_MS;
}
const WORKSPACE_ROOT = path.resolve(process.env.TERMINAI_WORKSPACE_ROOT || process.cwd());
const TERMINAL_CWD_MARKER = "\u001eTERMINAI_CWD_44fb5948\u001e";
const TERMINAL_OUTPUT_TRUNCATED = "... (output truncated)";

// Body parser
app.use(express.json());

function loadAuthMiddleware() {
  const apiKey = process.env.TERMINAI_API_KEY?.trim();

  if (!apiKey) {
    return;
  }

  const prefix = process.env.TERMINAI_AUTH_HEADER?.trim() || "x-api-key";
  const headerName = prefix.toLowerCase();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const raw = req.headers[headerName];
    let candidate = Array.isArray(raw) ? raw[0] : raw;
    if (!candidate && prefix === "authorization" && typeof req.headers.authorization === "string") {
      candidate = req.headers.authorization.replace(/^bearer\s+/i, "");
    }
    if (!candidate || candidate !== apiKey) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid API key." });
    }
    next();
  };
}

const authMiddleware: express.RequestHandler | undefined = loadAuthMiddleware();
const appAny: any = app;
function applyAuth(method: string, path: string, handler: express.RequestHandler) {
  if (!authMiddleware) {
    return appAny[method](path, handler);
  }
  return appAny[method](path, authMiddleware, handler);
}


// Lazy-loaded Gemini Client following guidance
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please configure secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}


/** Returns true when targetPath is inside the configured workspace root, including symlink resolution. */
function isInsideWorkspace(targetPath: string): boolean {
  let normalizedRoot;
  try {
    normalizedRoot = fs.realpathSync(WORKSPACE_ROOT);
  } catch (error) {
    if (error?.code === "ENOENT") {
      normalizedRoot = path.resolve(WORKSPACE_ROOT);
    } else {
      throw error;
    }
  }

  const absoluteTarget = path.resolve(targetPath);
  let normalizedTarget = absoluteTarget;
  let remainder = absoluteTarget;
  while (remainder !== normalizedRoot && !path.relative(path.resolve(WORKSPACE_ROOT), remainder).startsWith("..")) {
    try {
      normalizedTarget = fs.realpathSync(remainder);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      const parent = path.dirname(remainder);
      if (parent === remainder) {
        break;
      }
      remainder = parent;
    }
  }

  const relative = path.relative(normalizedRoot, normalizedTarget);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Resolves a user supplied path against a cwd and clamps it to the workspace root. */
function resolveWorkspacePath(inputPath: string | undefined, cwd = WORKSPACE_ROOT): string {
  const base = isInsideWorkspace(cwd) ? path.resolve(cwd) : WORKSPACE_ROOT;
  const resolved = inputPath ? path.resolve(base, inputPath) : base;
  if (!isInsideWorkspace(resolved)) {
    throw new Error("Access denied: path is outside the Terminai workspace.");
  }
  return resolved;
}

function resolveWorkspacePathStrict(inputPath: string | undefined, cwd = WORKSPACE_ROOT): string {
  const base = isInsideWorkspace(cwd) ? path.resolve(cwd) : WORKSPACE_ROOT;
  const resolved = inputPath ? path.resolve(base, inputPath) : base;
  if (!isInsideWorkspace(resolved)) {
    throw new Error("Access denied: path is outside the Terminai workspace.");
  }

  try {
    const real = fs.realpathSync(resolved);
    const realRoot = fs.realpathSync(base);
    if (!isInsideWorkspace(real)) {
      throw new Error("Access denied: path is outside the Terminai workspace.");
    }
    return real;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
      const parent = path.dirname(resolved);
      if (!isInsideWorkspace(parent)) {
        throw new Error("Access denied: path is outside the Terminai workspace.");
      }
      return resolved;
    }
    throw error;
  }
}

/** Converts an absolute workspace path into the relative path used by frontend file APIs. */
function toWorkspaceRelative(targetPath: string): string {
  const relative = path.relative(WORKSPACE_ROOT, targetPath);
  return relative === "" ? "." : relative;
}

function appendLimited(chunks: string[], text: string, state: { bytes: number; truncated: boolean }): string {
  if (!text || state.truncated) return "";
  const remaining = COMMAND_MAX_BUFFER - state.bytes;
  if (remaining <= 0) {
    state.truncated = true;
    return "";
  }
  const slice = text.slice(0, remaining);
  const redactedSlice = redactSensitiveOutput(slice);
  chunks.push(redactedSlice);
  state.bytes += slice.length;
  if (slice.length < text.length) state.truncated = true;
  return redactedSlice;
}


function parseSimpleCd(command: string): string | null {
  const match = command.match(/^cd(?:\s+(.+?))?\s*$/);
  if (!match) return null;
  const rawTarget = (match[1] || "").trim().replace(/^['"]|['"]$/g, "");
  return rawTarget === "" || rawTarget === "~" || rawTarget === "$HOME" ? "." : rawTarget.replace(/^\$HOME(?=\/|$)/, ".");
}

function looksLikeSandboxEscape(command: string): boolean {
  return /(^|[;&|\s])rm\s+[^;&|]*(\.\.|\s\/)(?=\s|$)/.test(command) || /(^|[;&|\s])(cat|less|more|head|tail|rm|cp|mv|touch|mkdir|rmdir)\s+[^;&|]*\/(etc|dev|proc|sys|root|tmp)(?=\/|\s|$)/.test(command);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Real-time System Statistics (CPU, Memory, Disk, Environment)
app.get("/api/system/stats", (req, res) => {
  try {
    const memoryFree = os.freemem();
    const memoryTotal = os.totalmem();
    const memoryUsage = memoryTotal > 0 ? ((memoryTotal - memoryFree) / memoryTotal) * 100 : 0;
    const uptime = os.uptime();
    const loadAvg = os.loadavg() || [0, 0, 0];
    const osType = os.type();
    const osRelease = os.release();

    const loadVal = typeof loadAvg[0] === "number" ? loadAvg[0] : 0;
    const cpuCores = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    let cpuModel = "Intel/AMD CPU";
    try {
      const cpus = os.cpus();
      if (cpus && cpus[0] && cpus[0].model) {
        cpuModel = cpus[0].model;
      }
    } catch (e) {
      console.error("Failed to fetch CPU model:", e);
    }

    execFile("df", ["-h", WORKSPACE_ROOT], { timeout: 5000 }, (err, stdout) => {
      let diskInfo = { total: "10GB", used: "2GB", free: "8GB", percent: "20%" };
      try {
        if (!err && stdout) {
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 5) {
            diskInfo = {
              total: parts[1] || "10GB",
              used: parts[2] || "2GB",
              free: parts[3] || "8GB",
              percent: parts[4] || "20%"
            };
          }
        }
      } catch (innerErr) {
        console.error("DF output parsing error:", innerErr);
      }

      try {
        res.json({
          cpu: {
            load: parseFloat(loadVal.toFixed(2)),
            cores: cpuCores,
            model: cpuModel
          },
          memory: {
            total: (memoryTotal / (1024 * 1024 * 1024)).toFixed(2) + " GB",
            free: (memoryFree / (1024 * 1024 * 1024)).toFixed(2) + " GB",
            percent: parseFloat(memoryUsage.toFixed(1))
          },
          disk: diskInfo,
          uptime,
          os: {
            type: osType,
            release: osRelease,
            platform: os.platform()
          },
          cwd: WORKSPACE_ROOT
        });
      } catch (sendError: any) {
        console.error("Failed to send stats response:", sendError);
        if (!res.headersSent) {
          res.status(500).json({ error: sendError.message });
        }
      }
    });
  } catch (error: any) {
    console.error("Failed in stats route:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Secure Real Terminal Command Executor with Smart Directory Tracking
const TERMINAL_WORKSPACE_ROOT = path.resolve(process.env.TERMINAI_WORKSPACE_ROOT || process.cwd());
const DEFAULT_ALLOWED_COMMANDS = new Set([
  'ls','dir','tree','cat','head','tail','less','more','find',
  'cd','pwd',
  'echo','grep','sed','awk','cut','sort','uniq','wc',
  'whoami','hostname','uptime','date','cal','df','du','free',
  'node','npm','npx','python','python3','pip','pip3',
  'git','curl','wget','unzip','tar','gzip','gunzip',
  'make','gcc','clang','javac','java','bash','sh','zsh','termux-info'
]);

function getAllowedCommands(): Set<string> {
  const raw = process.env.TERMINAI_ALLOWED_COMMANDS;
  if (!raw) return DEFAULT_ALLOWED_COMMANDS;
  const out = new Set<string>();
  for (const item of raw.split(',')) {
    const cmd = item.trim();
    if (cmd) out.add(cmd);
  }
  return out;
}

function validateCommandInput(command: string): string[] {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error('Command is required.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Command exceeds maximum allowed length.');
  }
  if (/[`$]\(/.test(trimmed)) {
    throw new Error('Command contains unsupported shell expansion syntax.');
  }
  const tokens = tokenizeCommand(trimmed);
  if (tokens.length === 0) {
    throw new Error('Command could not be parsed.');
  }
  return tokens;
}

function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === '\\' && !inSingle) {
      escape = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      current += char;
      continue;
    }

    if (char === ' ' && !inSingle && !inDouble) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}

function parseShellMetaOutsideQuotes(input: string): { valid: boolean; reason?: string } {
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && !inSingle) {
      escape = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (';|&<>'.includes(char)) {
        return { valid: false, reason: 'Command contains unsupported shell meta-character outside quotes.' };
      }
      if (char === '$' && input[i + 1] === '(') {
        return { valid: false, reason: 'Command contains unsupported shell expansion syntax.' };
      }
      if (char === '`') {
        return { valid: false, reason: 'Command contains unsupported shell expansion syntax.' };
      }
    }
  }

  return { valid: true };
}

function resolveCommandExecution(commandRaw: string, activeCwd: string) {
  const tokens = validateCommandInput(sanitizeSensitiveCommand(commandRaw));
  const commandName = tokens[0];
  const baseName = path.basename(commandName).toLowerCase();

  if (baseName === 'cd') {
    const target = tokens[1] ?? '.';
    const resolved = resolveWorkspacePath(target, activeCwd);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return { kind: 'cd', ok: false as const, stderr: `cd: no such file or directory: ${target}`, code: 1, nextCwd: activeCwd };
    }
    if (!isInsideWorkspace(resolved)) {
      return { kind: 'cd', ok: false as const, stderr: 'cd: path is outside the Terminai workspace', code: 1, nextCwd: activeCwd };
    }
    return { kind: 'cd', ok: true as const, code: 0, nextCwd: resolved };
  }

  if (!getAllowedCommands().has(baseName)) {
    return { kind: 'error', reason: `Command "${baseName}" is not allowed.` } as const;
  }

  let blocked = true;

  return { kind: 'exec', command: commandName, args: tokens.slice(1), blocked } as const;
}
app.post("/api/terminal/execute", (req, res) => {
  const { command, cwd } = req.body as { command?: string; cwd?: string };
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "Command is required" });
  }

  let activeCwd: string;
  try {
    activeCwd = resolveWorkspacePath(cwd || ".");
  } catch {
    activeCwd = WORKSPACE_ROOT;
  }

  const sanitizedCommand = sanitizeSensitiveCommand(command.trim());
  const cdTarget = parseSimpleCd(sanitizedCommand);
  if (cdTarget !== null) {
    try {
      const nextCwd = resolveWorkspacePath(cdTarget, activeCwd);
      if (!fs.existsSync(nextCwd) || !fs.statSync(nextCwd).isDirectory()) {
        return res.json({ stdout: "", stderr: `cd: no such file or directory: ${cdTarget}`, code: 1, newCwd: activeCwd });
      }
      return res.json({ stdout: "", stderr: "", code: 0, newCwd: nextCwd });
    } catch {
      console.warn(`[Sandbox] Blocked cd outside workspace: ${sanitizedCommand}`);
      return res.json({ stdout: "", stderr: "cd: path is outside the Terminai workspace", code: 1, newCwd: activeCwd });
    }
  }

  if (looksLikeSandboxEscape(sanitizedCommand)) {
    console.warn(`[Sandbox] Blocked terminal command outside workspace: ${sanitizedCommand}`);
    return res.status(403).json({
      stdout: "",
      stderr: "Command blocked: filesystem access is restricted to the Terminai workspace.",
      code: 126,
      newCwd: activeCwd
    });
  }

  const meta = parseShellMetaOutsideQuotes(sanitizedCommand);
  if (!meta.valid) {
    return res.status(400).json({
      stdout: "",
      stderr: meta.reason,
      code: 126,
      newCwd: activeCwd
    });
  }

  const execution = resolveCommandExecution(sanitizedCommand, activeCwd);

  if (execution.kind === 'cd') {
    return res.json({
      stdout: execution.ok ? "" : `cd: ${execution.stderr}`,
      stderr: execution.ok ? "" : "",
      code: execution.code,
      newCwd: execution.nextCwd
    });
  }

  if (execution.kind === 'error') {
    return res.status(400).json({
      stdout: "",
      stderr: execution.reason,
      code: 126,
      newCwd: activeCwd
    });
  }

  const child = spawn(execution.command, execution.args, {
    cwd: activeCwd,
    shell: false,
    env: { ...process.env, LANG: "en_US.UTF-8", PWD: activeCwd },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const orderedChunks: { stream: "stdout" | "stderr"; text: string }[] = [];
  const limitState = { bytes: 0, truncated: false };
  let timedOut = false;
  const timeoutMs = getCommandTimeoutMs();
  console.info(`[Smoke] timeout=${timeoutMs} cmd=${execution.command} args=${JSON.stringify(execution.args)} blocked=${execution.blocked}`);
  const timeout = setTimeout(() => {
    timedOut = true;
    console.info(`[Smoke] signaling SIGTERM for pid=${child.pid} cmd=${execution.command}`);
    child.kill("SIGTERM");
    setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); }, 1500).unref();
  }, timeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    const limitedText = appendLimited(stdoutChunks, text, limitState);
    if (limitedText) orderedChunks.push({ stream: "stdout", text: limitedText });
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    const limitedText = appendLimited(stderrChunks, text, limitState);
    if (limitedText) orderedChunks.push({ stream: "stderr", text: limitedText });
  });
  child.on("error", (error) => {
    appendLimited(stderrChunks, `Failed to start command: ${error.message}`, limitState);
  });
  child.on("close", (code) => {
    clearTimeout(timeout);
    let stdoutText = stdoutChunks.join("");
    let stderrText = stderrChunks.join("");
    let finalCwd = activeCwd;
    const parts = stdoutText.split(TERMINAL_CWD_MARKER);
    if (parts.length > 1) {
      stdoutText = parts.slice(0, -1).join(TERMINAL_CWD_MARKER).replace(/[\r\n]+$/, "");
      const candidate = parts[parts.length - 1].trim().split(/\r?\n/)[0];
      try {
        const resolvedCandidate = path.resolve(candidate);
        if (fs.existsSync(resolvedCandidate) && fs.statSync(resolvedCandidate).isDirectory() && isInsideWorkspace(resolvedCandidate)) {
          finalCwd = resolvedCandidate;
        }
      } catch {
        finalCwd = activeCwd;
      }
    }
    if (timedOut) stderrText += `${stderrText ? "\n" : ""}Command timed out after ${Math.round(timeoutMs / 1000)} seconds and was terminated.`;
    res.json({
      stdout: redactSensitiveOutput(stdoutText),
      stderr: redactSensitiveOutput(stderrText),
      output: orderedChunks,
      code: timedOut ? 124 : (code ?? 1),
      newCwd: finalCwd,
      truncated: limitState.truncated,
      truncationMessage: limitState.truncated ? TERMINAL_OUTPUT_TRUNCATED : undefined
    });
  });
});

function redactSensitiveOutput(text: string): string {
  return text
    .replace(/(https?:\/\/)([^@\s]+)@/g, "$1***@")
    .replace(/\b(ghp_[A-Za-z0-9_]{40,})\b/g, "ghp_***")
    .replace(/(Authorization:\s*)(Bearer\s+)([^\s]+)/gi, "$1$2***")
    .replace(/(x-api-key[\s:=]+)([^\s&"]+)/gi, "$1***");
}

function sanitizeSensitiveCommand(command: string): string {
  return command
    .replace(/\b(ghp_[A-Za-z0-9_]{40,})\b/g, "ghp_***")
    .replace(/(https?:\/\/)([^@\s]+)@/g, "$1***@");
}

// Local file browser APIs (File Tree explorer)
app.post("/api/file-manager/list", (req, res) => {
  const { dir } = req.body;
  if (typeof dir === "string" && dir.includes("\0")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  const baseDir = WORKSPACE_ROOT;
  let targetDir: string;
  try {
    targetDir = resolveWorkspacePathStrict(dir || ".", baseDir);
  } catch {
    console.warn(`[Sandbox] Blocked file list outside workspace: ${dir}`);
    return res.status(403).json({ error: "Access Denied: Sandbox escape prevented." });
  }

  try {
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found" });
    }
    const files = fs.readdirSync(targetDir);
    const results = files.map(file => {
      const fullPath = path.join(targetDir, file);
      try {
        const stat = fs.statSync(fullPath);
        const relativePath = toWorkspaceRelative(fullPath);
        return {
          name: file,
          path: relativePath === "" ? "." : relativePath,
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      } catch {
        return {
          name: file,
          path: toWorkspaceRelative(fullPath),
          type: "file",
          size: 0,
          mtime: new Date().toISOString()
        };
      }
    });
    res.json({
      files: results,
      currentFolder: toWorkspaceRelative(targetDir)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File reader
app.post("/api/file-manager/read", (req, res) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== "string" || filePath.includes("\0")) {
    return res.status(400).json({ error: "File path is required" });
  }

  let resolvedPath: string;
  try {
    resolvedPath = resolveWorkspacePathStrict(filePath);
  } catch {
    console.warn(`[Sandbox] Blocked file read outside workspace: ${filePath}`);
    return res.status(403).json({ error: "Access Denied." });
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(resolvedPath, "utf-8");
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File writer
app.post("/api/file-manager/write", (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || typeof filePath !== "string" || filePath.includes("\0")) {
    return res.status(400).json({ error: "File path is required" });
  }

  let resolvedPath: string;
  try {
    resolvedPath = resolveWorkspacePathStrict(filePath);
  } catch {
    console.warn(`[Sandbox] Blocked file write outside workspace: ${filePath}`);
    return res.status(403).json({ error: "Access Denied." });
  }

  try {
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content || "", "utf-8");
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File/Folder deleter
app.post("/api/file-manager/delete", (req, res) => {
  const { targetPath } = req.body;
  if (!targetPath || typeof targetPath !== "string" || targetPath.includes("\0")) {
    return res.status(400).json({ error: "Path is required" });
  }

  let resolvedPath: string;
  try {
    resolvedPath = resolveWorkspacePathStrict(targetPath);
    if (resolvedPath === WORKSPACE_ROOT) throw new Error("Cannot delete workspace root");
  } catch {
    console.warn(`[Sandbox] Blocked delete outside workspace/root: ${targetPath}`);
    return res.status(403).json({ error: "Access Denied: Deletion restricted." });
  }

  try {
    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(resolvedPath);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "File/Folder does not exist." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Folder creator
app.post("/api/file-manager/create-folder", (req, res) => {
  const { dirPath, name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Folder name is required" });
  }
  if ((dirPath && typeof dirPath === "string" && dirPath.includes("\0")) || name.includes("\0")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  let parentFolder: string;
  let targetFolder: string;
  try {
    parentFolder = resolveWorkspacePathStrict(dirPath || ".");
    targetFolder = resolveWorkspacePathStrict(name, parentFolder);
  } catch {
    console.warn(`[Sandbox] Blocked folder create outside workspace: ${dirPath}/${name}`);
    return res.status(403).json({ error: "Access Denied." });
  }

  try {
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Folder already exists" });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Package manager helper - Query native installations of standard development CLI tools
app.get("/api/package-manager/list", async (req, res) => {
  const baseDir = WORKSPACE_ROOT;
  const manifestPath = path.join(baseDir, "runtime", "package-baseline.json");

  let tools: any[] = [];
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, "utf-8");
      tools = JSON.parse(raw);
      if (!Array.isArray(tools)) tools = [];
    } else {
      console.warn(`[Package Manager] Baseline manifest not found at: ${manifestPath}, using fallback list`);
      tools = [
        { id: "git", displayName: "Git", aptPackages: "git", queryCommand: "git", category: "Version Control", description: "Distributed version control system", required: true },
        { id: "curl", displayName: "Curl", aptPackages: "curl", queryCommand: "curl", category: "Network", description: "Command line tool for transferring data via URL", required: true },
        { id: "wget", displayName: "Wget", aptPackages: "wget", queryCommand: "wget", category: "Network", description: "Non-interactive network downloader", required: true },
        { id: "jq", displayName: "JQ", aptPackages: "jq", queryCommand: "jq", category: "Utility", description: "Command-line light JSON query processor", required: true },
        { id: "tmux", displayName: "Tmux", aptPackages: "tmux", queryCommand: "tmux", category: "Terminal", description: "Terminal session multiplexer window manager", required: true },
        { id: "sqlite3", displayName: "SQLite3", aptPackages: "sqlite3", queryCommand: "sqlite3", category: "Database", description: "Command-line dynamic shell for SQLite DBs", required: true },
        { id: "python3", displayName: "Python3", aptPackages: "python3", queryCommand: "python3", category: "Runtime", description: "Python interpreter language runtime", required: true },
        { id: "nodejs", displayName: "Node.js", aptPackages: "nodejs", queryCommand: "node", category: "Runtime", description: "Node.js JavaScript server runtime engine", required: true },
        { id: "npm", displayName: "NPM", aptPackages: "npm", queryCommand: "npm", category: "Runtime", description: "Node package package indexing manager", required: true },
        { id: "gcc", displayName: "GCC", aptPackages: "gcc", queryCommand: "gcc", category: "Development", description: "GNU Compiler C language compiler core", required: true },
        { id: "build-essential", displayName: "Build Essential", aptPackages: "build-essential", queryCommand: "make", category: "Development", description: "Meta-package for compiling software (make, gcc, libc)", required: true },
        { id: "make", displayName: "Make", aptPackages: "make", queryCommand: "make", category: "Development", description: "Build engineering and task automation helper", required: true },
        { id: "ripgrep", displayName: "Ripgrep", aptPackages: "ripgrep", queryCommand: "rg", category: "Utility", description: "Fast, modern line-oriented search tool", required: true },
        { id: "htop", displayName: "Htop", aptPackages: "htop", queryCommand: "htop", category: "Utility", description: "Interactive process viewer and system monitor", required: true },
        { id: "nano", displayName: "Nano", aptPackages: "nano", queryCommand: "nano", category: "Development", description: "Simple, easy-to-use terminal-based text editor", required: true },
        { id: "openssh", displayName: "OpenSSH", aptPackages: "openssh-client openssh-server", queryCommand: "ssh", category: "Network", description: "Secure shell client for remote terminal logins", required: true },
        { id: "unzip", displayName: "Unzip", aptPackages: "unzip", queryCommand: "unzip", category: "Utility", description: "Extraction and diagnostic utility for ZIP archives", required: true },
        { id: "zip", displayName: "Zip", aptPackages: "zip", queryCommand: "zip", category: "Utility", description: "Compression and file packaging utility for ZIP format", required: true },
        { id: "tar", displayName: "Tar", aptPackages: "tar", queryCommand: "tar", category: "Utility", description: "GNU absolute tape archiver for tape/tarball archives", required: true }
      ];
    }
  } catch (err) {
    console.error("Failed to read runtime baseline packages manifest:", err);
  }

  try {
    const results = await checkPackageStatus(tools);
    const total = results.length;
    const installed = results.filter((t: any) => t.installed).length;
    const missing = total - installed;
    res.json({
      tools: results,
      readiness: {
        total,
        installed,
        missing,
        ready: missing === 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function sanitizePackageName(name: string): string {
  const cleaned = name.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0.+-]*$/.test(cleaned)) {
    throw new Error(`Invalid package name: ${name}`);
  }
  return cleaned;
}

app.get("/api/package-manager/baseline", (_req, res) => {
  const baseDir = WORKSPACE_ROOT;
  const manifestPath = path.join(baseDir, "runtime", "package-baseline.json");
  try {
    if (!fs.existsSync(manifestPath)) {
      return res.status(404).json({ error: "Package baseline manifest not found." });
    }
    const raw = fs.readFileSync(manifestPath, "utf-8");
    res.json({ packages: JSON.parse(raw) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/package-manager/install", (req, res) => {
  const { packageIds } = req.body as { packageIds?: string[] };
  if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
    return res.status(400).json({ error: "packageIds array is required." });
  }

  const baseline = readPackageBaseline();
  const packageMap = new Map(baseline.map((p: any) => [String(p.id), p]));
  const selected = packageIds.map(String).map(id => id.trim()).filter(id => id.length > 0);

  if (selected.length === 0) {
    return res.status(400).json({ error: "No valid package IDs provided." });
  }

  const unknown = selected.filter(id => !packageMap.has(id));
  if (unknown.length > 0) {
    return res.status(404).json({ error: `Unknown package: ${unknown[0]}` });
  }

  const aptPackages = selected
    .map(id => packageMap.get(id)!.aptPackages)
    .filter((item: any): item is string => typeof item === "string" && item.trim().length > 0);

  if (aptPackages.length === 0) {
    return res.status(400).json({ error: "No installable packages for the selected IDs." });
  }

  res.json({
    status: "authorized",
    selected,
    aptPackages
  });
});

// -------------------------------------------------------
// RUNTIME BOOTSTRAP — unified package + API bridge layer
// -------------------------------------------------------

const RUNTIME_BASELINE_PATH = path.resolve(__dirname, "runtime", "package-baseline.json");
const API_BASELINE_PATH = path.resolve(__dirname, "runtime", "api-baseline.json");

function readPackageBaseline(): any[] {
  try {
    if (fs.existsSync(RUNTIME_BASELINE_PATH)) {
      const raw = fs.readFileSync(RUNTIME_BASELINE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.packages || []);
    }
  } catch (e) {
    console.error("Failed to read package baseline:", e);
  }
  return [];
}

function readApiBaseline(): any[] {
  try {
    if (fs.existsSync(API_BASELINE_PATH)) {
      const raw = fs.readFileSync(API_BASELINE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.capabilities || []);
    }
  } catch (e) {
    console.error("Failed to read API baseline:", e);
  }
  return [];
}

type PkgManager = "apt" | "pkg" | "unknown";

function detectPackageManager(): PkgManager {
  if (process.env.PKG_MANAGER) {
    const forced = process.env.PKG_MANAGER;
    if (forced === "pkg") return "pkg";
    if (forced === "apt") return "apt";
  }
  // Termux sets ANDROID_ROOT or ANDROID_DATA
  if (process.env.ANDROID_ROOT || process.env.ANDROID_DATA) {
    return "pkg";
  }
  // Check for pkg binary
  try {
    fs.accessSync("/data/data/com.termux/files/usr/bin/pkg", fs.constants.X_OK);
    return "pkg";
  } catch { /* not termux */ }
  // Check for apt-get
  try {
    fs.accessSync("/usr/bin/apt-get", fs.constants.X_OK);
    return "apt";
  } catch { /* not debian */ }
  return "unknown";
}

function buildInstallCommand(packages: string[], manager: PkgManager): { argv: string[]; shell: boolean } {
  const pkgNames = packages
    .flatMap(p => p.split(/\s+/))
    .map(p => p.trim().toLowerCase())
    .filter(name => {
      if (!name) return false;
      if (!/^[a-z0-9][a-z0-9.+-]*$/.test(name)) {
        throw new Error(`Invalid package name: ${name}`);
      }
      return true;
    });

  const bin = manager === "pkg" ? "pkg" : "apt-get";
  const argv = manager === "pkg"
    ? [bin, "install", "-y", "--", ...pkgNames]
    : [bin, "install", "-y", "--", ...pkgNames];
  return { argv, shell: false };
}

function sanitizePackageNames(input: string[]): string[] {
  return input.map(name => {
    const cleaned = name.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0.+-]*$/.test(cleaned)) {
      throw new Error(`Invalid package name: ${name}`);
    }
    return cleaned;
  });
}

async function checkPackageStatus(baselines: any[]): Promise<any[]> {
  const finder = process.platform === "win32" ? "where" : "which";
  return Promise.all(
    baselines.map(
      (pkg) =>
        new Promise<any>((resolve) => {
          const cmdName = pkg.queryCommand || pkg.id;
          execFile(finder, [cmdName], { timeout: 5000 }, (err, stdout) => {
            if (err || !stdout) {
              resolve({ ...pkg, installed: false, version: null });
              return;
            }
            const versionCmd = cmdName === "gcc" ? ["--version", "|", "head", "-n", "1"] : ["--version"];
            execFile(cmdName, versionCmd.slice(0, 2), { timeout: 5000 }, (vErr, vStdout) => {
              let version: string | null = "Detected";
              if (!vErr && vStdout) {
                const firstLine = vStdout.trim().split("\n")[0];
                if (firstLine) {
                  const match = firstLine.match(/(\d+\.\d+(\.\d+)?)/);
                  version = match ? match[0] : firstLine.substring(0, 24);
                }
              }
              resolve({ ...pkg, installed: true, version });
            });
          });
        }),
    ),
  );
}

async function installMissingPackages(
  baselines: any[],
  missing: any[],
  manager: PkgManager,
): Promise<{ argv: { argv: string[]; shell: boolean }; sanitized: string[] }> {
  const pkgNames: string[] = [];
  for (const m of missing) {
    const name = manager === "pkg" ? (m.termuxPackages || m.aptPackages) : m.aptPackages;
    if (name) pkgNames.push(name);
  }
  const sanitized = sanitizePackageNames(pkgNames);
  const argv = buildInstallCommand(sanitized, manager);
  return { argv, sanitized };
}

// GET /api/runtime/bootstrap/status
app.get("/api/runtime/bootstrap/status", async (_req, res) => {
  try {
    const baselines = readPackageBaseline();
    const packages = await checkPackageStatus(baselines);
    const missing = packages.filter((p: any) => !p.installed);
    const requiredMissing = packages.filter((p: any) => !p.installed && p.required !== false);
    const installed = packages.filter((p: any) => p.installed);
    const manager = detectPackageManager();

    res.json({
      packageManager: manager,
      total: packages.length,
      installed: installed.length,
      missing: missing.length,
      requiredMissing: requiredMissing.length,
      runtimeReady: requiredMissing.length === 0,
      packages,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runtime/bootstrap/install
app.post("/api/runtime/bootstrap/install", async (req, res) => {
  try {
    const { packageIds } = req.body as { packageIds?: string[] };
    const baselines = readPackageBaseline();
    const packages = await checkPackageStatus(baselines);

    let missing: any[];
    if (packageIds && packageIds.length > 0) {
      const idSet = new Set(packageIds);
      missing = packages.filter((p: any) => idSet.has(p.id) && !p.installed);
    } else {
      missing = packages.filter((p: any) => !p.installed && p.installByDefault !== false);
    }

    if (missing.length === 0) {
      return res.json({ installed: true, message: "All baseline packages already installed.", installArgv: null, displayHint: null });
    }

    const manager = detectPackageManager();
    const { argv, sanitized } = await installMissingPackages(baselines, missing, manager);

    res.json({
      status: "ready",
      packageManager: manager,
      missingCount: missing.length,
      packages: sanitized,
      installArgv: argv.argv,
      displayHint: argv.argv.join(" "),
    });
  } catch (error: any) {
    res.status(error.message?.includes("Invalid package name") ? 400 : 500).json({ error: error.message });
  }
});

// POST /api/runtime/bootstrap/repair
app.post("/api/runtime/bootstrap/repair", async (_req, res) => {
  try {
    const baselines = readPackageBaseline();
    const packages = await checkPackageStatus(baselines);
    const missing = packages.filter((p: any) => !p.installed);

    if (missing.length === 0) {
      return res.json({ healthy: true, message: "Runtime is healthy. No repair needed.", installArgv: null, displayHint: null });
    }

    const manager = detectPackageManager();
    const { argv, sanitized } = await installMissingPackages(baselines, missing, manager);

    res.json({
      status: "repair-ready",
      packageManager: manager,
      missingCount: missing.length,
      packages: sanitized,
      installArgv: argv.argv,
      displayHint: argv.argv.join(" "),
    });
  } catch (error: any) {
    res.status(error.message?.includes("Invalid package name") ? 400 : 500).json({ error: error.message });
  }
});

// GET /api/runtime/api/status
app.get("/api/runtime/api/status", (_req, res) => {
  try {
    const capabilities = readApiBaseline();
    const simulated = capabilities.filter((c: any) => c.status === "simulated").length;
    const available = capabilities.filter((c: any) => c.status === "available").length;
    const unavailable = capabilities.filter((c: any) => c.status === "unavailable").length;
    const nativeRequired = capabilities.filter((c: any) => c.nativeRequired).length;

    res.json({
      capabilities,
      summary: {
        total: capabilities.length,
        simulated,
        available,
        unavailable,
        nativeRequired,
        oneAppReady: unavailable === 0 && nativeRequired === 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------
// API BRIDGE — internal capability invocation contract
// -------------------------------------------------------

const API_BRIDGE_CONTRACT_PATH = path.resolve(__dirname, "runtime", "api-bridge-contract.json");
const API_AUDIT_LOG_PATH = path.resolve(
  WORKSPACE_ROOT,
  "terminai_api_audit.jsonl"
);

let apiBridgeState = {
  deviceSettings: {
    batteryLevel: 82,
    batteryTemperature: "28.5 °C",
    isCharging: false,
    networkSsid: "TerminAI_Local_Link",
  } as any,
  clipboard: "TerminAI: Seamless local pipeline active.",
};

function readApiBridgeContract(): any {
  try {
    if (fs.existsSync(API_BRIDGE_CONTRACT_PATH)) {
      const raw = fs.readFileSync(API_BRIDGE_CONTRACT_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to read API bridge contract:", e);
  }
  return null;
}

function getApiCapabilityById(capabilityId: string): any {
  const caps = readApiBaseline();
  return caps.find((c: any) => c.id === capabilityId) || null;
}

function readApiAuditLog(): any[] {
  try {
    if (fs.existsSync(API_AUDIT_LOG_PATH)) {
      const raw = fs.readFileSync(API_AUDIT_LOG_PATH, "utf-8");
      return raw.trim().split("\n").filter(Boolean).map((line: string) => JSON.parse(line));
    }
  } catch (e) {
    console.error("Failed to read API audit log:", e);
  }
  return [];
}

function appendApiAuditEvent(event: any): void {
  try {
    const line = JSON.stringify(event) + "\n";
    fs.appendFileSync(API_AUDIT_LOG_PATH, line, "utf-8");
  } catch (e) {
    console.error("Failed to append API audit event:", e);
  }
}

function buildApiBridgeStatus(): any {
  const contract = readApiBridgeContract();
  const list = readApiBaseline();
  const available = list.filter((c: any) => c.status === "available").length;
  const simulated = list.filter((c: any) => c.status === "simulated").length;
  const unavailable = list.filter((c: any) => c.status === "unavailable").length;
  const permissionRequired = list.filter((c: any) => c.permission && c.permission !== "None").length;

  return {
    contract,
    capabilities: list,
    adapter: contract?.defaultAdapter || "simulated",
    total: list.length,
    available,
    simulated,
    unavailable,
    permissionRequired,
    auditLog: API_AUDIT_LOG_PATH,
  };
}

// Simulated capability handlers
function handleBatteryRead(): any {
  return {
    level: apiBridgeState.deviceSettings.batteryLevel,
    temperature: apiBridgeState.deviceSettings.batteryTemperature,
    isCharging: apiBridgeState.deviceSettings.isCharging,
    source: "simulated",
  };
}

function handleClipboardRead(): any {
  return { content: apiBridgeState.clipboard, source: "simulated" };
}

function handleClipboardWrite(payload: any): any {
  if (payload?.content && typeof payload.content === "string") {
    apiBridgeState.clipboard = payload.content;
  }
  return { content: apiBridgeState.clipboard, source: "simulated" };
}

function handleNotificationSend(payload: any): any {
  return {
    sent: false,
    simulated: true,
    message: "Native notification bridge not yet active. Notification logged.",
    title: payload?.title || "TerminAI",
    body: payload?.body || "Test notification",
  };
}

function handleStorageStatus(): any {
  return {
    workspaceRoot: WORKSPACE_ROOT,
    runtimeRoot: getRuntimeRoot(),
    source: "available",
  };
}

function handleIntentValidate(payload: any): any {
  const url = payload?.url || "";
  const valid = typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("intent://"));
  return { url, valid, simulated: true, message: valid ? "URL format valid." : "Invalid URL format." };
}

function handleVibrationPulse(payload: any): any {
  const pattern = payload?.pattern || [200];
  return { pattern, simulated: true, message: "Vibration simulated. Native haptics bridge not yet active." };
}

function handleNetworkInfoRead(): any {
  return {
    ssid: apiBridgeState.deviceSettings.networkSsid,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    source: "simulated",
  };
}

function handleSensorSnapshot(): any {
  return {
    accelerometer: { x: 0, y: 0, z: 9.8 },
    gyroscope: { x: 0, y: 0, z: 0 },
    light: 200,
    proximity: 5,
    source: "simulated",
    message: "Sensor data is simulated. Native sensor bridge not yet active.",
  };
}

function handleScriptShortcutsList(): any {
  return {
    categories: ["system", "network", "development", "utility"],
    source: "available",
    message: "Script shortcut categories available.",
  };
}

function invokeApiCapability(capabilityId: string, action: string, payload: any): any {
  const contract = readApiBridgeContract();
  const capability = getApiCapabilityById(capabilityId);

  // Check if capability exists
  if (!capability) {
    return { success: false, status: "error", message: `Unknown capability: ${capabilityId}` };
  }

  // Check if blocked
  if (contract?.blockedCapabilities?.includes(capabilityId)) {
    return { success: false, status: "blocked", message: `Capability '${capabilityId}' is blocked until native permission flow exists.` };
  }

  // Check if unavailable
  if (capability.status === "unavailable") {
    return { success: false, status: "unavailable", message: `Capability '${capabilityId}' is not available.` };
  }

  // Check if action is allowlisted
  const allowlisted = contract?.allowlistedActions?.[capabilityId] || [];
  if (!allowlisted.includes(action)) {
    return { success: false, status: "blocked", message: `Action '${action}' is not allowlisted for capability '${capabilityId}'.` };
  }

  // Dispatch to handler
  const simulated = capability.status === "simulated";
  let data: any;
  let message = "";

  switch (`${capabilityId}:${action}`) {
    case "battery:read":
      data = handleBatteryRead();
      message = "Battery status (simulated).";
      break;
    case "clipboard:read":
      data = handleClipboardRead();
      message = "Clipboard read (simulated).";
      break;
    case "clipboard:write":
      data = handleClipboardWrite(payload);
      message = "Clipboard write (simulated).";
      break;
    case "notifications:send":
      data = handleNotificationSend(payload);
      message = data.message;
      break;
    case "storage:status":
      data = handleStorageStatus();
      message = "Storage status.";
      break;
    case "intent-open-url:validate":
      data = handleIntentValidate(payload);
      message = data.message;
      break;
    case "intent-send:validate":
      data = handleIntentValidate(payload);
      message = data.message;
      break;
    case "vibration:pulse":
      data = handleVibrationPulse(payload);
      message = data.message;
      break;
    case "network-info:read":
      data = handleNetworkInfoRead();
      message = "Network info (simulated).";
      break;
    case "sensors:snapshot":
      data = handleSensorSnapshot();
      message = data.message;
      break;
    case "boot-startup:status":
      return { success: true, status: "simulated", data: { enabled: false }, message: "Boot startup status (simulated). Native boot receiver not yet active." };
    case "file-picker:status":
      return { success: true, status: "unavailable", data: null, message: "File picker requires native Android permission flow." };
    case "script-shortcuts:list":
      data = handleScriptShortcutsList();
      message = data.message;
      break;
    default:
      return { success: false, status: "error", message: `No handler for ${capabilityId}:${action}.` };
  }

  return { success: true, status: simulated ? "simulated" : "ok", data, message, simulated };
}

// GET /api/runtime/api/bridge/status
app.get("/api/runtime/api/bridge/status", (_req, res) => {
  try {
    const status = buildApiBridgeStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runtime/api/invoke
app.post("/api/runtime/api/invoke", (req, res) => {
  try {
    const { capabilityId, action, payload } = req.body as {
      capabilityId?: string;
      action?: string;
      payload?: Record<string, unknown>;
    };

    if (!capabilityId || !action) {
      return res.status(400).json({ success: false, message: "capabilityId and action are required." });
    }

    const result = invokeApiCapability(capabilityId, action, payload || {});

    // Audit the invocation
    const auditEvent = {
      timestamp: new Date().toISOString(),
      capabilityId,
      action,
      adapter: readApiBridgeContract()?.defaultAdapter || "simulated",
      status: result.status || "error",
      message: result.message || "",
    };
    appendApiAuditEvent(auditEvent);

    res.json({
      ...result,
      capabilityId,
      action,
      adapter: readApiBridgeContract()?.defaultAdapter || "simulated",
      audited: true,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, audited: false });
  }
});

// -------------------------------------------------------
// RUNTIME STATE — first-run provisioning & startup check
// -------------------------------------------------------

const RUNTIME_STATE_PATH = path.resolve(
  WORKSPACE_ROOT,
  "terminai_runtime_state.json"
);

const RUNTIME_STATE_EXAMPLE_PATH = path.resolve(__dirname, "runtime", "runtime-state.example.json");

type BootstrapMode = "check-only" | "prompt-user" | "auto-install-enabled" | "native-bundled";

interface RuntimeState {
  firstRunCompleted: boolean;
  lastBootstrapCheck: string | null;
  lastBootstrapInstall: string | null;
  detectedPackageManager: string;
  runtimeReady: boolean;
  installedCount: number;
  missingCount: number;
  requiredMissingCount: number;
  apiReadyCount: number;
  apiSimulatedCount: number;
  apiUnavailableCount: number;
  bootstrapMode: BootstrapMode;
}

function getDefaultRuntimeState(): RuntimeState {
  return {
    firstRunCompleted: false,
    lastBootstrapCheck: null,
    lastBootstrapInstall: null,
    detectedPackageManager: "unknown",
    runtimeReady: false,
    installedCount: 0,
    missingCount: 0,
    requiredMissingCount: 0,
    apiReadyCount: 0,
    apiSimulatedCount: 0,
    apiUnavailableCount: 0,
    bootstrapMode: "prompt-user",
  };
}

function readRuntimeState(): RuntimeState {
  try {
    if (fs.existsSync(RUNTIME_STATE_PATH)) {
      const raw = fs.readFileSync(RUNTIME_STATE_PATH, "utf-8");
      return { ...getDefaultRuntimeState(), ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to read runtime state:", e);
  }
  return getDefaultRuntimeState();
}

function writeRuntimeState(state: RuntimeState): void {
  try {
    fs.writeFileSync(RUNTIME_STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write runtime state:", e);
  }
}

async function runStartupCheck(): Promise<RuntimeState> {
  console.log("[Runtime] Running startup check...");

  const baselines = readPackageBaseline();
  const packages = await checkPackageStatus(baselines);
  const missing = packages.filter((p: any) => !p.installed);
  const requiredMissing = packages.filter((p: any) => !p.installed && p.required !== false);
  const installed = packages.filter((p: any) => p.installed);
  const manager = detectPackageManager();

  const apiCaps = readApiBaseline();
  const apiReady = apiCaps.filter((c: any) => c.status === "available").length;
  const apiSimulated = apiCaps.filter((c: any) => c.status === "simulated").length;
  const apiUnavailable = apiCaps.filter((c: any) => c.status === "unavailable").length;

  const autoBootstrap = process.env.TERMINAI_AUTO_BOOTSTRAP === "true";
  const bootstrapMode: BootstrapMode = autoBootstrap ? "auto-install-enabled" : "prompt-user";

  let state: RuntimeState = {
    firstRunCompleted: false,
    lastBootstrapCheck: new Date().toISOString(),
    lastBootstrapInstall: null,
    detectedPackageManager: manager,
    runtimeReady: requiredMissing.length === 0,
    installedCount: installed.length,
    missingCount: missing.length,
    requiredMissingCount: requiredMissing.length,
    apiReadyCount: apiReady,
    apiSimulatedCount: apiSimulated,
    apiUnavailableCount: apiUnavailable,
    bootstrapMode,
  };

  // Auto-bootstrap if enabled
  if (autoBootstrap && missing.length > 0) {
    console.log(`[Runtime] TERMINAI_AUTO_BOOTSTRAP=true, installing ${missing.length} missing packages...`);
    try {
      const installResult = await installMissingPackages(baselines, missing, manager);
      const prepared = installResult.argv;
      const sanitized = installResult.sanitized;
      const argv = prepared.argv;
      if (!argv || argv.length === 0) {
        console.error("[Runtime] No valid install argv produced.");
      } else {
        const workDir = path.join(os.tmpdir(), `terminai-install-${crypto.randomUUID()}`);
        fs.mkdirSync(workDir, { recursive: true });
        const controller = new AbortController();
        const timeoutMs = getCommandTimeoutMs();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        const child = spawn(argv[0], argv.slice(1), {
          cwd: workDir,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          signal: controller.signal,
        });
        let stdout = "";
        let stderr = "";
        let outBytes = 0;
        const sink = (kind: "stdout" | "stderr", data: Buffer) => {
          const text = data.toString("utf8");
          outBytes += Buffer.byteLength(text);
          if (outBytes > COMMAND_MAX_BUFFER) {
            controller.abort();
            return;
          }
          if (kind === "stdout") stdout += text;
          else stderr += text;
        };
        child.stdout!.on("data", (data: Buffer) => sink("stdout", data));
        child.stderr!.on("data", (data: Buffer) => sink("stderr", data));
        child.on("error", (err) => console.error(`[Runtime] Auto-bootstrap failed: ${err.message}`));
        child.on("close", (code) => {
          clearTimeout(timeoutHandle);
          try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
          if (code !== 0) {
            console.error(`[Runtime] Auto-bootstrap exited with ${code}`);
            if (stderr) console.error(`[Runtime] stderr: ${stderr.slice(0, 500)}`);
          } else {
            console.log(`[Runtime] Auto-bootstrap completed for: ${sanitized.join(" ")}`);
            if (stdout) console.log(`[Runtime] stdout: ${stdout.slice(0, 500)}`);
          }
          checkPackageStatus(baselines).then((updatedPackages: any[]) => {
            const stillMissing = updatedPackages.filter((p: any) => !p.installed && p.required !== false);
            state.runtimeReady = stillMissing.length === 0;
            state.installedCount = updatedPackages.filter((p: any) => p.installed).length;
            state.missingCount = updatedPackages.filter((p: any) => !p.installed).length;
            state.requiredMissingCount = stillMissing.length;
            state.lastBootstrapInstall = new Date().toISOString();
            writeRuntimeState(state);
          }).catch((e: any) => {
            console.error("[Runtime] Post-bootstrap status check failed:", e);
          });
        });
      }
    } catch (e: any) {
      console.error(`[Runtime] Auto-bootstrap error: ${e.message}`);
    }
  }

  writeRuntimeState(state);
  console.log(`[Runtime] Startup check complete. Runtime ready: ${state.runtimeReady}, Packages: ${state.installedCount}/${baselines.length}, Mode: ${bootstrapMode}`);
  return state;
}

// GET /api/runtime/status — unified readiness for the whole app
app.get("/api/runtime/status", async (_req, res) => {
  try {
    const state = readRuntimeState();
    const baselines = readPackageBaseline();
    const packages = await checkPackageStatus(baselines);
    const missing = packages.filter((p: any) => !p.installed);
    const requiredMissing = packages.filter((p: any) => !p.installed && p.required !== false);
    const installed = packages.filter((p: any) => p.installed);

    const apiCaps = readApiBaseline();
    const apiReady = apiCaps.filter((c: any) => c.status === "available").length;
    const apiSimulated = apiCaps.filter((c: any) => c.status === "simulated").length;
    const apiUnavailable = apiCaps.filter((c: any) => c.status === "unavailable").length;

    // Refresh state with latest check
    const freshState: RuntimeState = {
      ...state,
      lastBootstrapCheck: new Date().toISOString(),
      detectedPackageManager: detectPackageManager(),
      runtimeReady: requiredMissing.length === 0,
      installedCount: installed.length,
      missingCount: missing.length,
      requiredMissingCount: requiredMissing.length,
      apiReadyCount: apiReady,
      apiSimulatedCount: apiSimulated,
      apiUnavailableCount: apiUnavailable,
    };
    writeRuntimeState(freshState);

    const bundleStatus = checkRuntimeBundleStatus();

    res.json({
      state: freshState,
      packages: {
        total: baselines.length,
        installed: installed.length,
        missing: missing.length,
        requiredMissing: requiredMissing.length,
        runtimeReady: requiredMissing.length === 0,
        items: packages,
      },
      api: {
        total: apiCaps.length,
        ready: apiReady,
        simulated: apiSimulated,
        unavailable: apiUnavailable,
        oneAppReady: apiUnavailable === 0,
        capabilities: apiCaps,
      },
      bundle: bundleStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/runtime/first-run/complete
app.post("/api/runtime/first-run/complete", (req, res) => {
  try {
    const { bootstrapMode } = req.body as { bootstrapMode?: BootstrapMode };
    const state = readRuntimeState();
    state.firstRunCompleted = true;
    state.lastBootstrapCheck = new Date().toISOString();
    if (bootstrapMode) {
      state.bootstrapMode = bootstrapMode;
    }
    writeRuntimeState(state);
    res.json({ success: true, message: "First run marked complete.", state });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------
// RUNTIME BUNDLE — native-bundled runtime manifest
// -------------------------------------------------------

const RUNTIME_BUNDLE_PATH = path.resolve(__dirname, "runtime", "runtime-bundle.json");
const RUNTIME_ASSETS_DIR = path.resolve(__dirname, "runtime", "assets");

function readRuntimeBundle(): any {
  try {
    if (fs.existsSync(RUNTIME_BUNDLE_PATH)) {
      const raw = fs.readFileSync(RUNTIME_BUNDLE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to read runtime bundle:", e);
  }
  return null;
}

function getRuntimeRoot(): string | null {
  // 1. Explicit env var
  if (process.env.TERMINAI_RUNTIME_ROOT) {
    return path.resolve(process.env.TERMINAI_RUNTIME_ROOT);
  }
  // 2. Check candidates from bundle manifest
  const bundle = readRuntimeBundle();
  if (bundle?.installRootCandidates) {
    for (const candidate of bundle.installRootCandidates) {
      let resolved = candidate;
      // Expand $TERMINAI_RUNTIME_ROOT
      if (resolved.startsWith("$TERMINAI_RUNTIME_ROOT")) {
        continue; // already checked above
      }
      // Expand ~
      if (resolved.startsWith("~/")) {
        resolved = path.join(os.homedir(), resolved.slice(2));
      }
      // Make relative paths absolute
      if (!path.isAbsolute(resolved)) {
        resolved = path.resolve(process.cwd(), resolved);
      }
      // Check if directory exists
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    }
  }
  return null;
}

function checkRuntimeBundleStatus(): any {
  const bundle = readRuntimeBundle();
  const runtimeRoot = getRuntimeRoot();

  const assetsExist = fs.existsSync(RUNTIME_ASSETS_DIR);
  const binDir = path.join(RUNTIME_ASSETS_DIR, "bin");
  const libDir = path.join(RUNTIME_ASSETS_DIR, "lib");
  const etcDir = path.join(RUNTIME_ASSETS_DIR, "etc");
  const homeDir = path.join(RUNTIME_ASSETS_DIR, "home");

  const binExists = fs.existsSync(binDir);
  const libExists = fs.existsSync(libDir);
  const etcExists = fs.existsSync(etcDir);
  const homeExists = fs.existsSync(homeDir);

  // Determine mode
  let mode = "host-bootstrap";
  if (runtimeRoot && assetsExist && binExists) {
    mode = "native-bundled";
  } else if (runtimeRoot || (assetsExist && binExists)) {
    mode = "mixed";
  }

  const bundleReady = !!(runtimeRoot && assetsExist && binExists && libExists);

  return {
    bundle,
    runtimeRoot,
    workspaceRoot: WORKSPACE_ROOT,
    mode,
    bundleReady,
    assets: {
      base: assetsExist,
      bin: binExists,
      lib: libExists,
      etc: etcExists,
      home: homeExists,
    },
    notes: bundleReady
      ? "Native-bundled runtime detected. TerminAI can use bundled assets."
      : runtimeRoot
        ? "Runtime root set but assets incomplete. Falling back to host package manager."
        : "No bundled runtime detected. Using host package manager (apt/pkg) for bootstrap.",
  };
}

// ── Runtime Bundle Integrity ──────────────────────────────────────────

const RUNTIME_LOCK_PATH = path.resolve(__dirname, "runtime", "runtime-bundle.lock.json");

function readRuntimeBundleLock(): any {
  try {
    if (fs.existsSync(RUNTIME_LOCK_PATH)) {
      const raw = fs.readFileSync(RUNTIME_LOCK_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to read runtime bundle lock:", e);
  }
  return null;
}

function scanAssetFiles(dir, baseDir = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanAssetFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      const relPath = "/" + path.relative(baseDir, fullPath).replace(/\\/g, "/");
      files.push({ path: relPath, fullPath });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function computeFileHash(filePath) {
  try {
    const hash = createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
  } catch {
    return null;
  }
}

function checkRuntimeBundleIntegrity(): any {
  const lock = readRuntimeBundleLock();
  const bundle = readRuntimeBundle();

  const lockFilePresent = !!lock;
  const assetFiles = scanAssetFiles(RUNTIME_ASSETS_DIR);
  const realFileCount = assetFiles.length;
  const hasRealFiles = realFileCount > 0;

  // Placeholder mode: no lock file and no real files yet
  const placeholderMode = !lockFilePresent && !hasRealFiles;

  if (!lockFilePresent) {
    return {
      lockFilePresent: false,
      placeholderMode,
      hasRealFiles,
      fileCountActual: realFileCount,
      integrityOk: placeholderMode, // OK in placeholder mode (nothing to check)
      missingFiles: [],
      changedFiles: [],
      extraFiles: [],
      notes: placeholderMode
        ? "Placeholder mode: no lock file and no real asset files. Run 'node scripts/build-runtime-bundle.mjs' after adding assets."
        : "Lock file missing but asset files exist. Run 'node scripts/build-runtime-bundle.mjs' to generate lock.",
    };
  }

  // Build maps
  const lockFiles = new Map((lock.files || []).map((f) => [f.path, f]));
  const actualFiles = new Map(assetFiles.map((f) => [f.path, f]));

  const missingFiles = [];
  const changedFiles = [];
  const extraFiles = [];
  let matchCount = 0;

  // Check lock entries against actual files
  for (const [lockPath, lockEntry] of lockFiles) {
    const actual = actualFiles.get(lockPath);
    if (!actual) {
      missingFiles.push({ path: lockPath, expectedSize: (lockEntry as any).size });
      continue;
    }
    const actualStat = fs.statSync(actual.fullPath);
    if (actualStat.size !== (lockEntry as any).size) {
      changedFiles.push({ path: lockPath, expectedSize: (lockEntry as any).size, actualSize: actualStat.size, reason: "size" });
      continue;
    }
    // Verify hash
    const hash = createHash("sha256");
    hash.update(fs.readFileSync(actual.fullPath));
    const actualHash = hash.digest("hex");
    if (actualHash !== (lockEntry as any).sha256) {
      changedFiles.push({ path: lockPath, expectedSize: (lockEntry as any).size, actualSize: actualStat.size, reason: "hash" });
      continue;
    }
    matchCount++;
  }

  // Check for extra files not in lock
  for (const [actualPath] of actualFiles) {
    if (!lockFiles.has(actualPath)) {
      extraFiles.push({ path: actualPath });
    }
  }

  const integrityOk = missingFiles.length === 0 && changedFiles.length === 0 && extraFiles.length === 0;

  return {
    lockFilePresent: true,
    placeholderMode: false,
    hasRealFiles: true,
    fileCountExpected: lock.fileCount,
    fileCountActual: realFileCount,
    totalBytesExpected: lock.totalBytes,
    totalBytesActual: assetFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(f.fullPath).size; } catch { return sum; }
    }, 0),
    matchCount,
    integrityOk,
    missingFiles,
    changedFiles,
    extraFiles,
    generatedAt: lock.generatedAt,
    notes: integrityOk
      ? `Integrity OK: ${matchCount} files verified.`
      : `Integrity issues: ${missingFiles.length} missing, ${changedFiles.length} changed, ${extraFiles.length} extra.`,
  };
}

// GET /api/runtime/bundle/status — enhanced with integrity
app.get("/api/runtime/bundle/status", async (_req, res) => {
  try {
    const status = checkRuntimeBundleStatus();
    const integrity = await checkRuntimeBundleIntegrity();
    res.json({ ...status, integrity });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/runtime/bundle/integrity — integrity-only endpoint
app.get("/api/runtime/bundle/integrity", async (_req, res) => {
  try {
    const integrity = await checkRuntimeBundleIntegrity();
    res.json(integrity);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Device & Build Status API layer (TerminAI runtime modules)
let deviceClipboard = "TerminAI: Seamless local pipeline active.";
let deviceSettings = {
  batteryLevel: 82,
  batteryTemperature: "28.5 °C",
  isCharging: false,
  networkSsid: "TerminAI_Secure_WiFi",
  permissions: {
    camera: "granted",
    gps: "granted",
    microphone: "prompt",
    storage: "granted"
  }
};

app.get("/api/device/build-status", (req, res) => {
  const baseDir = WORKSPACE_ROOT;
  const telemetryPath = path.join(baseDir, "terminai_telemetry.json");

  let telemetryData = {
    appName: "TerminAI Desktop",
    packageName: "io.terminai.app",
    versionName: "1.0.4",
    versionCode: 104,
    buildProfile: "Debug",
    targetAbis: ["arm64-v8a", "x86_64"],
    keystoreSigning: "Self-signed Developer Certificate",
    minSdkVersion: 26,
    targetSdkVersion: 34,
    artifactOutputName: "terminai-debug-v1.0.4.apk",
    lastCompileTimestamp: new Date().toISOString()
  };

  try {
    if (fs.existsSync(telemetryPath)) {
      const saved = fs.readFileSync(telemetryPath, "utf-8");
      telemetryData = { ...telemetryData, ...JSON.parse(saved) };
    } else {
      fs.writeFileSync(telemetryPath, JSON.stringify(telemetryData, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to load or initialize telemetry artifact file:", err);
  }

  res.json({
    telemetry: telemetryData,
    device: {
      ...deviceSettings,
      clipboard: deviceClipboard,
      systemSdk: 34,
      manufacturer: "TerminAI",
      brand: "Generic Virtual Device",
      cpuArch: os.arch()
    }
  });
});

app.post("/api/device/build-status", (req, res) => {
  const baseDir = WORKSPACE_ROOT;
  const telemetryPath = path.join(baseDir, "terminai_telemetry.json");
  const { telemetry, device } = req.body;

  if (device) {
    if (typeof device.clipboard === "string") {
      deviceClipboard = device.clipboard;
    }
    if (device.permissions) {
      deviceSettings.permissions = { ...deviceSettings.permissions, ...device.permissions };
    }
    if (typeof device.batteryLevel === "number") {
      deviceSettings.batteryLevel = device.batteryLevel;
    }
    if (typeof device.isCharging === "boolean") {
      deviceSettings.isCharging = device.isCharging;
    }
  }

  if (telemetry) {
    try {
      fs.writeFileSync(telemetryPath, JSON.stringify(telemetry, null, 2), "utf-8");
    } catch (err: any) {
      return res.status(500).json({ error: `Save failed: ${err.message}` });
    }
  }

  res.json({ success: true, message: "Device & Build telemetry updated successfully!" });
});

// Intelligent Task and Shell Command optimizer using Gemini or OpenRouter
app.post("/api/gemini/optimize-command", async (req, res) => {
  const { prompt, currentContext } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "User goal/intent is required." });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const systemInstruction = `You are Terminai's Intelligent AI Shell Optimizer. Your task is to translate natural language intentions into highly optimized, safe, modern, and rapid Linux/Bash terminal commands (e.g. suggesting elegant xargs, modern find, sed/awk, custom short loops, or parallel execution hacks).

You MUST return a structure-validated JSON object satisfying this precise schema:
{
  "optimizedCommand": "The actual single-line executable bash command",
  "explanation": "A clean, concise 1-2 paragraph markdown explanation detailing why this is fast and which flags do what.",
  "alternative": "A safer, localized, dry-run alternative command or tips."
}
No other text envelopes. Just output the clean JSON object. Ensure the commands represent actual Unix/Ubuntu commands found in standard workspaces.`;

  const contents = `Translate this user request to an optimized command: "${prompt}".
Active directory or context string: "${currentContext || 'Workspace Root'}"`;

  // Helper to clean and parse response from OpenRouter/LLM that might have Markdown wrapping or reasoning tags (<think>)
  function cleanResponseJSON(text: string): string {
    let cleaned = text.trim();
    
    // Strip <think>...</think> reasoning tags if present
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    
    // Remove markdown code fences if present (e.g. ```json ... ```)
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
      cleaned = cleaned.replace(/\s*```$/, "");
      cleaned = cleaned.trim();
    }
    
    // Locate the first '{' and last '}' to isolate JSON
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
    
    return cleaned;
  }

  // 1. If OpenRouter API Key is active, route through OpenRouter
  if (openrouterKey && openrouterKey.trim() !== "") {
    try {
      const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
      console.log(`[OpenRouter] Sending request using model: ${model}`);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey.trim()}`,
          "HTTP-Referer": "https://github.com/termux/termux-app",
          "X-Title": "Terminai Client"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: contents }
          ]
          // Note: Omitting response_format for safety so it is compatible with 100% of OpenRouter models (including thinking and legacy models).
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter API response error ${response.status}: ${errBody}`);
      }

      const resData = await response.json();
      console.log("[OpenRouter Debug] Full response body successfully parsed.");
      
      if (resData.error) {
        throw new Error(`OpenRouter error payload returned: ${resData.error.message || JSON.stringify(resData.error)}`);
      }

      const outputText = resData.choices?.[0]?.message?.content;
      if (!outputText) {
        console.error("[OpenRouter Debug] Empty choices object:", JSON.stringify(resData));
        throw new Error("No payload content returned in OpenRouter chat completions response.");
      }

      const cleanOutput = cleanResponseJSON(outputText);
      const parsedJSON = JSON.parse(cleanOutput);
      return res.json(parsedJSON);
    } catch (err: any) {
      console.error("OpenRouter Execution Error:", err);
      
      // If we have standard GEMINI_API_KEY as fallback, we can fall back to standard integration gracefully!
      if (process.env.GEMINI_API_KEY) {
        console.warn("⚠️ OpenRouter request failed, falling back to Gemini API endpoint...");
      } else {
        return res.status(500).json({ error: `OpenRouter Request Failed: ${err.message}` });
      }
    }
  }

  // 2. Fallback to standard Google GenAI native platform integration
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["optimizedCommand", "explanation", "alternative"],
          properties: {
            optimizedCommand: { type: Type.STRING, description: "Highly optimized execution statement ready to run" },
            explanation: { type: Type.STRING, description: "Detailed visual markdown explanation of the command" },
            alternative: { type: Type.STRING, description: "Dry-run/safest approach alternative" }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Failed to secure content response from Gemini model.");
    }
    const data = JSON.parse(jsonText.trim());
    res.json(data);
  } catch (error: any) {
    if (error.message && error.message.includes("GEMINI_API_KEY")) {
      res.status(500).json({ 
        error: "Database AI Credentials missing: Please configure either GEMINI_API_KEY or OPENROUTER_API_KEY in active Secrets configurations." 
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// ----------------------------------------------------
// VITE CLIENT INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Integrate Vite as a dev middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static compiled assets in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Terminai Graphical Shell Backend actively listening on ${HOST}:${PORT}`);
  });

  // Run startup check after server is listening (non-blocking)
  runStartupCheck().catch((e: any) => {
    console.error("[Runtime] Startup check failed:", e);
  });
}

export default app;

if (process.env.NODE_ENV !== "test") {
  startServer();
}
