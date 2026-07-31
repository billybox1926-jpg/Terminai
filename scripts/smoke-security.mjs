#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";
import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const SMOKE_PORT_MIN = 32100;
const SMOKE_PORT_MAX = 32200;
const port = Number.parseInt(process.env.SMOKE_PORT || process.env.TEST_PORT || `${SMOKE_PORT_MIN + Math.floor(Math.random() * (SMOKE_PORT_MAX - SMOKE_PORT_MIN + 1))}`, 10);
const baseUrl = `http://127.0.0.1:${port}`;
const workspaceRoot = path.join(os.tmpdir(), `terminai-smoke-${Date.now()}`);

function ensureSmokeWorkspace() {
  fs.mkdirSync(path.join(workspaceRoot, "runtime"), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, "package.json"), JSON.stringify({ name: "terminai-smoke", private: true }));
  fs.writeFileSync(path.join(workspaceRoot, "runtime", "package-baseline.json"), JSON.stringify([
    { id: "echo", displayName: "Echo", aptPackages: "echo", queryCommand: "echo", category: "Utility", description: "Smoke baseline" }
  ]));
  fs.writeFileSync(path.join(workspaceRoot, "runtime", "api-baseline.json"), JSON.stringify([]));
  fs.writeFileSync(path.join(workspaceRoot, "runtime", "runtime-bundle.json"), JSON.stringify({ version: "smoke" }));
  fs.writeFileSync(path.join(workspaceRoot, "runtime", "runtime-bundle.lock.json"), JSON.stringify({ files: [] }));
}

const serverEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
    TERMINAI_COMMAND_TIMEOUT_MS: "100",
    TERMINAI_COMMAND_MAX_BUFFER: "4096",
    TERMINAI_WORKSPACE_ROOT: workspaceRoot
  }).filter(([key, value]) => key && !key.startsWith("=") && typeof value === "string")
);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
      ...(process.env.TERMINAI_API_KEY ? { "x-api-key": process.env.TERMINAI_API_KEY } : {}),
    },
  });
  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function waitForServer(child, logs) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}${logs ? `: ${logs.trim().split("\n").slice(-20).join("\n")}` : ""}`);
    }
    try {
      const health = await request("/api/health");
      if (health.response.ok) return;
    } catch {
      // Not ready yet.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for production server at ${baseUrl}${logs ? `: ${logs.trim().split("\n").slice(-20).join("\n")}` : ""}`);
}

function stopServer(child) {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
  }
}

function looksLikeTimeoutEvidence(body) {
  if (!body || typeof body !== "object") return false;
  const code = body.code;
  const stderr = String(body.stderr || "");
  const stdout = String(body.stdout || "");
  if (code === 124 || code === 143) return true;
  return /timed?\s*out|killed|terminated/i.test(stderr) || /timed?\s*out|killed|terminated/i.test(stdout);
}

async function main() {
  ensureSmokeWorkspace();

  const child = spawn(process.execPath, ["dist/server.js"], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(child, logs);

    const runtime = await request("/api/runtime/status");
    if (!runtime.response.ok || !runtime.body?.packages || !runtime.body?.api) {
      throw new Error("/api/runtime/status did not return expected runtime shape");
    }

    const traversal = await request("/api/file-manager/read", {
      method: "POST",
      body: JSON.stringify({ filePath: "../package.json" })
    });
    if (traversal.response.status !== 403) {
      throw new Error(`Path traversal should be blocked with 403, got ${traversal.response.status}`);
    }

    const invalidInstall = await request("/api/package-manager/install", {
      method: "POST",
      body: JSON.stringify({ packageIds: ["not-in-runtime-baseline"] })
    });
    if (![400, 404].includes(invalidInstall.response.status)) {
      throw new Error(`Invalid package install should be rejected, got ${invalidInstall.response.status}`);
    }

    const timeout = await request("/api/terminal/execute", {
      method: "POST",
      body: JSON.stringify({ command: 'echo TerminAI_smoke_passed' })
    });

    if (!timeout.response.ok || !String(timeout.body?.stdout ?? "").includes("TerminAI_smoke_passed")) {
      throw new Error(
        `Terminal execute did not return expected output. ` +
          `Response: ${JSON.stringify(timeout.body)}`
      );
    }

    console.log("Security smoke checks passed.");
  } catch (error) {
    console.error("Security smoke checks failed:", error.message);
    if (logs.trim()) {
      console.error("Server logs:");
      console.error(logs);
    }
    process.exitCode = 1;
  } finally {
    stopServer(child);
  }
}

await main();
