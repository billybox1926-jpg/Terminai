#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const port = Number.parseInt(process.env.TEST_PORT || `${32000 + Math.floor(Math.random() * 1000)}`, 10);
const baseUrl = `http://127.0.0.1:${port}`;
const serverEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    PORT: String(port),
    TERMINAI_COMMAND_TIMEOUT_MS: "100",
    TERMINAI_COMMAND_MAX_BUFFER: "4096"
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
      ...(options.headers || {})
    }
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

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const { response } = await request("/api/runtime/status");
      if (response.ok) return;
    } catch {
      // Not ready yet.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for production server");
}

function stopServer(child) {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
  }
}

async function main() {
  const child = spawn(process.execPath, ["dist/server.js"], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  child.stderr.on("data", (chunk) => { logs += chunk.toString(); });

  try {
    await waitForServer(child);

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
      body: JSON.stringify({ command: "node -e \"setTimeout(() => {}, 1000)\"" })
    });
    if (!timeout.response.ok || timeout.body?.code === 0) {
      throw new Error("Command timeout env var was not accepted/enforced by terminal executor");
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
