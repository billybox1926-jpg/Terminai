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
    const memoryUsage = ((memoryTotal - memoryFree) / memoryTotal) * 100;
    const uptime = os.uptime();
    const loadAvg = os.loadavg();
    const osType = os.type();
    const osRelease = os.release();

    exec("df -h . | tail -1", (err, stdout) => {
      let diskInfo = { total: "10GB", used: "2GB", free: "8GB", percent: "20%" };
      if (!err && stdout) {
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
          diskInfo = {
            total: parts[1],
            used: parts[2],
            free: parts[3],
            percent: parts[4]
          };
        }
      }
      res.json({
        cpu: {
          load: parseFloat(loadAvg[0].toFixed(2)),
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || "Intel/AMD CPU"
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
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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

  exec(fullCommand, { cwd: activeCwd, env: { ...process.env, LANG: "en_US.UTF-8" } }, (error, stdout, stderr) => {
    // Split the stdout string by separator to capture CLI output vs ending directory
    const parts = stdout.split(marker);
    let commandOutput = parts[0] || "";
    let finalCwd = parts[1] ? parts[1].trim() : activeCwd;

    // Clean up trailing and leading spaces/newlines from system output
    commandOutput = commandOutput.replace(/[\r\n]+$/, "");

    // Gracefully clamp directory resolved checks
    if (!fs.existsSync(finalCwd) || !fs.statSync(finalCwd).isDirectory()) {
      finalCwd = activeCwd;
    }

    res.json({
      stdout: commandOutput,
      stderr: stderr || "",
      code: error ? (error.code ?? 1) : 0,
      newCwd: finalCwd
    });
  });
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
    { name: "git", description: "Distributed version control system", category: "Version Control" },
    { name: "curl", description: "Command line tool for transferring data via URL", category: "Network" },
    { name: "wget", description: "Non-interactive network downloader", category: "Network" },
    { name: "jq", description: "Command-line light JSON query processor", category: "Utility" },
    { name: "tmux", description: "Terminal session multiplexer window manager", category: "Terminal" },
    { name: "sqlite3", description: "Command-line dynamic shell for SQLite DBs", category: "Database" },
    { name: "python3", description: "Python interpreter language runtime", category: "Runtime" },
    { name: "node", description: "Node.js JavaScript server runtime engine", category: "Runtime" },
    { name: "npm", description: "Node package package indexing manager", category: "Runtime" },
    { name: "gcc", description: "GNU Compiler C language compiler core", category: "Development" },
    { name: "make", description: "Build engineering and task automation helper", category: "Development" }
  ];

  Promise.all(
    tools.map(tool => {
      return new Promise<any>((resolve) => {
        exec(`which ${tool.name}`, (err, stdout) => {
          if (err || !stdout) {
            resolve({ ...tool, installed: false, version: null });
          } else {
            const versionCmd = tool.name === "gcc" ? "gcc --version | head -n 1" : `${tool.name} --version || ${tool.name} -v`;
            exec(versionCmd, (vErr, vStdout) => {
              let version = "Detected";
              if (!vErr && vStdout) {
                const firstLine = vStdout.trim().split("\n")[0];
                const match = firstLine.match(/(\d+\.\d+(\.\d+)?)/);
                version = match ? match[0] : firstLine.substring(0, 24);
              }
              resolve({ ...tool, installed: true, version });
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

// Intelligent Task and Shell Command optimizer using Gemini
app.post("/api/gemini/optimize-command", async (req, res) => {
  const { prompt, currentContext } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "User goal/intent is required." });
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `You are WebTermux's Intelligent AI Shell Optimizer. Your task is to translate natural language intentions into highly optimized, safe, modern, and rapid Linux/Bash terminal commands (e.g. suggesting elegant xargs, modern find, sed/awk, custom short loops, or parallel execution hacks).

You MUST return a structure-validated JSON object satisfying this precise schema:
{
  "optimizedCommand": "The actual single-line executable bash command",
  "explanation": "A clean, concise 1-2 paragraph markdown explanation detailing why this is fast and which flags do what.",
  "alternative": "A safer, localized, dry-run alternative command or tips."
}
No other text envelopes. Just output the clean JSON object. Ensure the commands represent actual Unix/Ubuntu commands found in standard workspaces.`;

    const contents = `Translate this user request to an optimized command: "${prompt}".
Active directory or context string: "${currentContext || 'Workspace Root'}"`;

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
    res.status(500).json({ error: error.message });
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
    console.log(`WebTermux Graphical Shell Backend actively listening on port ${PORT}`);
  });
}

startServer();
