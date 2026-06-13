import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec, execFile } from "child_process";
import { randomUUID } from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const WORKSPACE_ROOT = path.resolve(process.env.TERMINAI_WORKSPACE_ROOT || process.cwd());
const COMMAND_TIMEOUT_MS = Number(process.env.TERMINAI_COMMAND_TIMEOUT_MS || 30_000);
const COMMAND_MAX_BUFFER = Number(process.env.TERMINAI_COMMAND_MAX_BUFFER || 1024 * 1024);

app.use(express.json({ limit: "1mb" }));

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Set it only when AI command optimization is needed.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function isInsideWorkspace(candidatePath: string): boolean {
  const resolved = path.resolve(candidatePath);
  return resolved === WORKSPACE_ROOT || resolved.startsWith(WORKSPACE_ROOT + path.sep);
}

function resolveWorkspacePath(inputPath = "."): string {
  const resolved = path.resolve(WORKSPACE_ROOT, inputPath);
  if (!isInsideWorkspace(resolved)) {
    throw new Error("Access denied: path escapes TerminAI workspace root.");
  }
  return resolved;
}

function firstVersionLine(output: string): string {
  const firstLine = output.trim().split("\n")[0] || "Detected";
  const match = firstLine.match(/(\d+\.\d+(\.\d+)?)/);
  return match ? match[0] : firstLine.slice(0, 40);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "TerminAI",
    workspaceRoot: WORKSPACE_ROOT,
  });
});

app.get("/api/system/stats", (_req, res) => {
  try {
    const memoryFree = os.freemem();
    const memoryTotal = os.totalmem();
    const memoryUsage = ((memoryTotal - memoryFree) / memoryTotal) * 100;
    const loadAvg = os.loadavg();

    execFile("df", ["-h", WORKSPACE_ROOT], { timeout: 5000 }, (err, stdout) => {
      let diskInfo = { total: "unknown", used: "unknown", free: "unknown", percent: "unknown" };
      if (!err && stdout) {
        const lines = stdout.trim().split("\n");
        const parts = lines[lines.length - 1]?.trim().split(/\s+/) || [];
        if (parts.length >= 5) {
          diskInfo = {
            total: parts[1],
            used: parts[2],
            free: parts[3],
            percent: parts[4],
          };
        }
      }

      res.json({
        cpu: {
          load: parseFloat((loadAvg[0] || 0).toFixed(2)),
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || "Unknown CPU",
        },
        memory: {
          total: `${(memoryTotal / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          free: `${(memoryFree / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          percent: parseFloat(memoryUsage.toFixed(1)),
        },
        disk: diskInfo,
        uptime: os.uptime(),
        os: {
          type: os.type(),
          release: os.release(),
          platform: os.platform(),
        },
        cwd: WORKSPACE_ROOT,
      });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/terminal/execute", (req, res) => {
  const { command, cwd } = req.body as { command?: string; cwd?: string };
  if (!command?.trim()) {
    return res.status(400).json({ error: "Command is required." });
  }

  let activeCwd: string;
  try {
    activeCwd = resolveWorkspacePath(cwd || ".");
  } catch (error: any) {
    return res.status(403).json({ error: error.message });
  }

  const marker = `__TERMINAI_CWD_${randomUUID().replace(/-/g, "")}__`;
  const fullCommand = `${command}\nCOMMAND_STATUS=$?\necho ""\necho "${marker}"\npwd\nexit $COMMAND_STATUS`;

  exec(
    fullCommand,
    {
      cwd: activeCwd,
      env: { ...process.env, LANG: "en_US.UTF-8" },
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: COMMAND_MAX_BUFFER,
    },
    (error: any, stdout, stderr) => {
      const parts = stdout.split(marker);
      const commandOutput = (parts[0] || "").replace(/[\r\n]+$/, "");
      const reportedCwd = parts[1]?.trim();
      const finalCwd = reportedCwd && isInsideWorkspace(reportedCwd) ? path.resolve(reportedCwd) : activeCwd;

      res.json({
        stdout: commandOutput,
        stderr: stderr || "",
        code: error ? error.code ?? 1 : 0,
        newCwd: finalCwd,
        timedOut: Boolean(error?.killed),
      });
    },
  );
});

app.post("/api/file-manager/list", (req, res) => {
  const { dir } = req.body as { dir?: string };
  let targetDir: string;

  try {
    targetDir = resolveWorkspacePath(dir || ".");
  } catch (error: any) {
    return res.status(403).json({ error: error.message });
  }

  try {
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found." });
    }

    const files = fs.readdirSync(targetDir).map((file) => {
      const fullPath = path.join(targetDir, file);
      const stat = fs.statSync(fullPath);
      const relativePath = path.relative(WORKSPACE_ROOT, fullPath);
      return {
        name: file,
        path: relativePath === "" ? "." : relativePath,
        type: stat.isDirectory() ? "directory" : "file",
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      };
    });

    res.json({
      files,
      currentFolder: path.relative(WORKSPACE_ROOT, targetDir) || ".",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/file-manager/read", (req, res) => {
  const { filePath } = req.body as { filePath?: string };
  if (!filePath) return res.status(400).json({ error: "File path is required." });

  try {
    const resolvedPath = resolveWorkspacePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File not found." });
    }
    if (!fs.statSync(resolvedPath).isFile()) {
      return res.status(400).json({ error: "Path is not a file." });
    }
    res.json({ content: fs.readFileSync(resolvedPath, "utf-8") });
  } catch (error: any) {
    const status = error.message?.includes("Access denied") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post("/api/file-manager/write", (req, res) => {
  const { filePath, content } = req.body as { filePath?: string; content?: string };
  if (!filePath) return res.status(400).json({ error: "File path is required." });

  try {
    const resolvedPath = resolveWorkspacePath(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, content || "", "utf-8");
    res.json({ success: true });
  } catch (error: any) {
    const status = error.message?.includes("Access denied") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post("/api/file-manager/delete", (req, res) => {
  const { targetPath } = req.body as { targetPath?: string };
  if (!targetPath) return res.status(400).json({ error: "Path is required." });

  try {
    const resolvedPath = resolveWorkspacePath(targetPath);
    if (resolvedPath === WORKSPACE_ROOT) {
      return res.status(403).json({ error: "Access denied: cannot delete workspace root." });
    }
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File or folder does not exist." });
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolvedPath);
    }
    res.json({ success: true });
  } catch (error: any) {
    const status = error.message?.includes("Access denied") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post("/api/file-manager/create-folder", (req, res) => {
  const { dirPath, name } = req.body as { dirPath?: string; name?: string };
  if (!name) return res.status(400).json({ error: "Folder name is required." });
  if (name.includes(path.sep) || name.includes("..")) {
    return res.status(400).json({ error: "Folder name must be a simple directory name." });
  }

  try {
    const parentFolder = resolveWorkspacePath(dirPath || ".");
    const targetFolder = resolveWorkspacePath(path.join(path.relative(WORKSPACE_ROOT, parentFolder), name));
    if (fs.existsSync(targetFolder)) {
      return res.status(400).json({ error: "Folder already exists." });
    }
    fs.mkdirSync(targetFolder, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    const status = error.message?.includes("Access denied") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.get("/api/package-manager/list", (_req, res) => {
  const tools = [
    { name: "git", description: "Distributed version control system", category: "Version Control" },
    { name: "curl", description: "Command line tool for transferring data via URL", category: "Network" },
    { name: "wget", description: "Non-interactive network downloader", category: "Network" },
    { name: "jq", description: "Command-line JSON query processor", category: "Utility" },
    { name: "tmux", description: "Terminal session multiplexer", category: "Terminal" },
    { name: "sqlite3", description: "SQLite command-line shell", category: "Database" },
    { name: "python3", description: "Python interpreter", category: "Runtime" },
    { name: "node", description: "Node.js JavaScript runtime", category: "Runtime" },
    { name: "npm", description: "Node package manager", category: "Runtime" },
    { name: "gcc", description: "GNU C compiler", category: "Development" },
    { name: "make", description: "Build automation helper", category: "Development" },
  ];

  const finder = process.platform === "win32" ? "where" : "which";

  Promise.all(
    tools.map(
      (tool) =>
        new Promise<any>((resolve) => {
          execFile(finder, [tool.name], { timeout: 5000 }, (err, stdout) => {
            if (err || !stdout) {
              resolve({ ...tool, installed: false, version: null });
              return;
            }

            execFile(tool.name, ["--version"], { timeout: 5000 }, (versionErr, versionStdout) => {
              resolve({
                ...tool,
                installed: true,
                version: versionErr ? "Detected" : firstVersionLine(versionStdout),
              });
            });
          });
        }),
    ),
  )
    .then((tools) => res.json({ tools }))
    .catch((error) => res.status(500).json({ error: error.message }));
});

app.post("/api/gemini/optimize-command", async (req, res) => {
  const { prompt, currentContext } = req.body as { prompt?: string; currentContext?: string };
  if (!prompt?.trim()) {
    return res.status(400).json({ error: "User goal or intent is required." });
  }

  try {
    const ai = getGeminiClient();
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const systemInstruction = `You are TerminAI's shell command optimizer. Translate a user's goal into one concise, modern, local terminal command.

Return only a JSON object with this shape:
{
  "optimizedCommand": "single-line shell command",
  "explanation": "brief explanation of why this command is useful and what its flags do",
  "alternative": "safer dry-run or lower-risk alternative"
}

Prefer safe, inspectable commands. Avoid destructive commands unless the user's request explicitly requires them, and provide a safer alternative when risk exists.`;

    const contents = `User request: ${prompt}\nCurrent workspace context: ${currentContext || WORKSPACE_ROOT}`;
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["optimizedCommand", "explanation", "alternative"],
          properties: {
            optimizedCommand: { type: Type.STRING, description: "Single-line shell command" },
            explanation: { type: Type.STRING, description: "Concise explanation" },
            alternative: { type: Type.STRING, description: "Safer dry-run or alternative" },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("AI optimizer returned an empty response.");
    res.json(JSON.parse(jsonText.trim()));
  } catch (error: any) {
    const status = error.message?.includes("GEMINI_API_KEY") ? 503 : 500;
    res.status(status).json({ error: error.message });
  }
});

// ----------------------------------------------------
// VITE CLIENT INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TerminAI local workspace listening on http://localhost:${PORT}`);
    console.log(`Workspace root: ${WORKSPACE_ROOT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start TerminAI:", error);
  process.exit(1);
});
