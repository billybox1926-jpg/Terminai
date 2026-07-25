#!/usr/bin/env node
/**
 * scripts/smoke-runtime.mjs
 *
 * Regression smoke for web/runtime paths used by release candidates:
 *   - /api/health
 *   - /api/runtime/status shape
 *   - /api/terminal/execute basic command path
 *
 * Starts the production bundle directly, so this is safe to run after
 * `npm run build` and does not depend on the dev server.
 */

import { spawn } from "node:child_process";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const SMOKE_PORT_MIN = 32300;
const SMOKE_PORT_MAX = 32400;
const port = Number.parseInt(process.env.SMOKE_PORT || `${SMOKE_PORT_MIN + Math.floor(Math.random() * (SMOKE_PORT_MAX - SMOKE_PORT_MIN + 1))}`, 10);
const baseUrl = `http://127.0.0.1:${port}`;
const serverPath = path.resolve("dist/server.js");

if (!fs.existsSync(serverPath)) {
  console.error("❌ server bundle missing. Run `npm run build` first.");
  process.exit(1);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(requestPath, options = {}) {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }
  }
  return { response, body };
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}${logs ? `: ${logs.trim().split("\n").slice(-20).join("\n")}` : ""}`);
    }
    try {
      const { response } = await request("/api/health");
      if (response.ok) {
        return;
      }
    } catch {
      // not ready yet
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

async function assertHealthy() {
  const { response, body } = await request("/api/health");
  if (!response.ok) {
    throw new Error(`/api/health failed with status ${response.status}`);
  }
  if (body?.status !== "ok") {
    throw new Error(`/api/health returned unexpected payload: ${JSON.stringify(body)}`);
  }
}

async function assertTerminalRoute() {
  const { response, body } = await request("/api/terminal/execute", {
    method: "POST",
    body: JSON.stringify({ command: "echo hello", cwd: "." })
  });

  if (!response.ok) {
    throw new Error(`/api/terminal/execute failed with status ${response.status}`);
  }

  const stdout = typeof body === "string" ? undefined : body?.stdout;
  if (!stdout || !String(stdout).includes("hello")) {
    throw new Error(
      `/api/terminal/execute did not return expected stdout: ${JSON.stringify(body)}`
    );
  }
}

async function assertRuntimeStateShape() {
  const { response, body } = await request("/api/runtime/status");
  if (!response.ok) {
    throw new Error(`/api/runtime/status failed with status ${response.status}`);
  }
  if (typeof body !== "object" || body === null) {
    throw new Error("/api/runtime/status is not an object");
  }
  if (body?.state === undefined || body?.packages === undefined || body?.api === undefined) {
    throw new Error(`/api/runtime/status missing required keys: ${JSON.stringify(body)}`);
  }
}

async function main() {
  const serverEnv = Object.fromEntries(
    Object.entries({
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production"
    }).filter(([key, value]) => key && !key.startsWith("=") && typeof value === "string")
  );

  const child = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString("utf8");
  });

  try {
    await waitForServer(child);
    await assertHealthy();
    await assertTerminalRoute();
    await assertRuntimeStateShape();
    console.log("✅ Release smoke checks passed.");
  } catch (error) {
    console.error("❌ Release smoke checks failed.");
    console.error(`   ${error?.message || error}`);
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
