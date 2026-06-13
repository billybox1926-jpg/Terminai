import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize express app
const app = express();
const PORT = 3000;

// Body parser
app.use(express.json());

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

    exec("df -h . | tail -1", (err, stdout) => {
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
          cwd: process.cwd()
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
app.post("/api/terminal/execute", (req, res) => {
  const { command, cwd } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Command is required" });
  }

  const activeCwd = cwd || process.cwd();
  const marker = "__CWD_SEPARATOR_44fb5948__";
  
  // We couple the user command and always print pwd after. Use semicolon to execute pwd even if preceding fails.
  const fullCommand = `${command} ; echo "" ; echo "${marker}" ; pwd`;

  try {
    exec(fullCommand, { cwd: activeCwd, env: { ...process.env, LANG: "en_US.UTF-8" } }, (error, stdout, stderr) => {
      try {
        const stdoutStr = stdout || "";
        // Split the stdout string by separator to capture CLI output vs ending directory
        const parts = stdoutStr.split(marker);
        let commandOutput = parts[0] || "";
        let finalCwd = parts[1] ? parts[1].trim() : activeCwd;

        // Clean up trailing and leading spaces/newlines from system output
        commandOutput = commandOutput.replace(/[\r\n]+$/, "");

        // Gracefully clamp directory resolved checks
        try {
          if (!fs.existsSync(finalCwd) || !fs.statSync(finalCwd).isDirectory()) {
            finalCwd = activeCwd;
          }
        } catch (e) {
          finalCwd = activeCwd;
        }

        res.json({
          stdout: commandOutput,
          stderr: stderr || "",
          code: error ? (error.code ?? 1) : 0,
          newCwd: finalCwd
        });
      } catch (innerErr: any) {
        console.error("Terminal callback internal exception:", innerErr);
        if (!res.headersSent) {
          res.status(500).json({ error: innerErr.message });
        }
      }
    });
  } catch (error: any) {
    console.error("Terminal top-level execute error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Local file browser APIs (File Tree explorer)
app.post("/api/file-manager/list", (req, res) => {
  const { dir } = req.body;
  const baseDir = process.cwd();
  const targetDir = dir ? path.resolve(baseDir, dir) : baseDir;

  // Sandbox check to avoid listing outside of dev environment folder if restrictive
  if (!targetDir.startsWith(baseDir)) {
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
        const relativePath = path.relative(baseDir, fullPath);
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
          path: path.relative(baseDir, fullPath),
          type: "file",
          size: 0,
          mtime: new Date().toISOString()
        };
      }
    });
    res.json({
      files: results,
      currentFolder: path.relative(baseDir, targetDir) || "."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File reader
app.post("/api/file-manager/read", (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "File path is required" });

  const baseDir = process.cwd();
  const resolvedPath = path.resolve(baseDir, filePath);

  if (!resolvedPath.startsWith(baseDir)) {
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
  if (!filePath) return res.status(400).json({ error: "File path is required" });

  const baseDir = process.cwd();
  const resolvedPath = path.resolve(baseDir, filePath);

  if (!resolvedPath.startsWith(baseDir)) {
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
  if (!targetPath) return res.status(400).json({ error: "Path is required" });

  const baseDir = process.cwd();
  const resolvedPath = path.resolve(baseDir, targetPath);

  if (!resolvedPath.startsWith(baseDir) || resolvedPath === baseDir) {
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
  if (!name) return res.status(400).json({ error: "Folder name is required" });

  const baseDir = process.cwd();
  const parentFolder = dirPath ? path.resolve(baseDir, dirPath) : baseDir;
  const targetFolder = path.join(parentFolder, name);

  if (!targetFolder.startsWith(baseDir)) {
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
app.get("/api/package-manager/list", (req, res) => {
  const tools = [
    { name: "git", queryCmd: "git", description: "Distributed version control system", category: "Version Control" },
    { name: "curl", queryCmd: "curl", description: "Command line tool for transferring data via URL", category: "Network" },
    { name: "wget", queryCmd: "wget", description: "Non-interactive network downloader", category: "Network" },
    { name: "jq", queryCmd: "jq", description: "Command-line light JSON query processor", category: "Utility" },
    { name: "tmux", queryCmd: "tmux", description: "Terminal session multiplexer window manager", category: "Terminal" },
    { name: "sqlite3", queryCmd: "sqlite3", description: "Command-line dynamic shell for SQLite DBs", category: "Database" },
    { name: "python3", queryCmd: "python3", description: "Python interpreter language runtime", category: "Runtime" },
    { name: "node", queryCmd: "node", description: "Node.js JavaScript server runtime engine", category: "Runtime" },
    { name: "npm", queryCmd: "npm", description: "Node package package indexing manager", category: "Runtime" },
    { name: "gcc", queryCmd: "gcc", description: "GNU Compiler C language compiler core", category: "Development" },
    { name: "build-essential", queryCmd: "make", description: "Meta-package for compiling software (make, gcc, libc)", category: "Development" },
    { name: "make", queryCmd: "make", description: "Build engineering and task automation helper", category: "Development" },
    { name: "ripgrep", queryCmd: "rg", description: "Fast, modern line-oriented search tool", category: "Utility" },
    { name: "htop", queryCmd: "htop", description: "Interactive process viewer and system monitor", category: "Utility" },
    { name: "nano", queryCmd: "nano", description: "Simple, easy-to-use terminal-based text editor", category: "Development" },
    { name: "openssh", queryCmd: "ssh", description: "Secure shell client for remote terminal logins", category: "Network" },
    { name: "java-common", queryCmd: "java", description: "Java language execution environment baseline", category: "Runtime" },
    { name: "unzip", queryCmd: "unzip", description: "Extraction and diagnostic utility for ZIP archives", category: "Utility" },
    { name: "zip", queryCmd: "zip", description: "Compression and file packaging utility for ZIP format", category: "Utility" },
    { name: "tar", queryCmd: "tar", description: "GNU absolute tape archiver for tape/tarball archives", category: "Utility" }
  ];

  Promise.all(
    tools.map(tool => {
      return new Promise<any>((resolve) => {
        exec(`which ${tool.queryCmd}`, (err, stdout) => {
          if (err || !stdout) {
            resolve({ name: tool.name, description: tool.description, category: tool.category, installed: false, version: null });
          } else {
            const versionCmd = tool.queryCmd === "gcc" ? "gcc --version | head -n 1" : `${tool.queryCmd} --version || ${tool.queryCmd} -v`;
            exec(versionCmd, (vErr, vStdout) => {
              let version = "Detected";
              try {
                if (!vErr && vStdout) {
                  const firstLine = vStdout.trim().split("\n")[0];
                  if (firstLine) {
                    const match = firstLine.match(/(\d+\.\d+(\.\d+)?)/);
                    version = match ? match[0] : firstLine.substring(0, 24);
                  }
                }
              } catch (parseErr) {
                console.error("Failed to parse utility tool version:", parseErr);
              }
              resolve({ name: tool.name, description: tool.description, category: tool.category, installed: true, version });
            });
          }
        });
      });
    })
  ).then(results => {
    res.json({ tools: results });
  }).catch(error => {
    res.status(500).json({ error: error.message });
  });
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
  const baseDir = process.env.TERMINAI_WORKSPACE_ROOT || process.cwd();
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
  const baseDir = process.env.TERMINAI_WORKSPACE_ROOT || process.cwd();
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

  // 1. If OpenRouter API Key is active, route through OpenRouter
  if (openrouterKey && openrouterKey.trim() !== "") {
    try {
      const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
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
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter API response error ${response.status}: ${errBody}`);
      }

      const resData = await response.json();
      const outputText = resData.choices?.[0]?.message?.content;
      if (!outputText) {
        throw new Error("No payload content returned in OpenRouter chat completions response.");
      }

      const parsedJSON = JSON.parse(outputText.trim());
      return res.json(parsedJSON);
    } catch (err: any) {
      console.error("OpenRouter Execution Error:", err);
      return res.status(500).json({ error: `OpenRouter Request Failed: ${err.message}` });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Terminai Graphical Shell Backend actively listening on port ${PORT}`);
  });
}

startServer();
