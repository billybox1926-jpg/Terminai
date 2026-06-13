#!/usr/bin/env node
/**
 * scripts/runtime-status.mjs
 * 
 * Prints a summary of TerminAI runtime configuration without starting the server.
 * 
 * Usage:
 *   node scripts/runtime-status.mjs
 * 
 * Environment variables:
 *   TERMINAI_WORKSPACE_ROOT  - workspace root path
 *   TERMINAI_RUNTIME_ROOT   - runtime root path (optional)
 *   TERMINAI_AUTO_BOOTSTRAP - auto-bootstrap mode (optional)
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`  Error reading ${filePath}: ${e.message}`);
  }
  return null;
}

function checkDir(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// Read manifests
const packageBaseline = readJSON(path.join(PROJECT_ROOT, "runtime", "package-baseline.json"));
const packageList = Array.isArray(packageBaseline) ? packageBaseline : (packageBaseline?.packages || []);
const apiBaseline = readJSON(path.join(PROJECT_ROOT, "runtime", "api-baseline.json"));
const runtimeBundle = readJSON(path.join(PROJECT_ROOT, "runtime", "runtime-bundle.json"));
const runtimeState = readJSON(path.join(PROJECT_ROOT, "terminai_runtime_state.json"));

// Check runtime assets
const assetsDir = path.join(PROJECT_ROOT, "runtime", "assets");
const assets = {
  base: checkDir(assetsDir),
  bin: checkDir(path.join(assetsDir, "bin")),
  lib: checkDir(path.join(assetsDir, "lib")),
  etc: checkDir(path.join(assetsDir, "etc")),
  home: checkDir(path.join(assetsDir, "home")),
};

// Detect runtime root
let runtimeRoot = process.env.TERMINAI_RUNTIME_ROOT || null;
if (!runtimeRoot && runtimeBundle?.installRootCandidates) {
  for (const candidate of runtimeBundle.installRootCandidates) {
    let resolved = candidate;
    if (resolved.startsWith("$TERMINAI_RUNTIME_ROOT")) continue;
    if (resolved.startsWith("~/")) resolved = path.join(os.homedir(), resolved.slice(2));
    if (!path.isAbsolute(resolved)) resolved = path.resolve(PROJECT_ROOT, resolved);
    if (checkDir(resolved)) { runtimeRoot = resolved; break; }
  }
}

// Detect package manager
let pkgManager = "unknown";
if (process.env.ANDROID_ROOT || process.env.ANDROID_DATA) pkgManager = "pkg";
else if (checkDir("/data/data/com.termux/files/usr/bin/pkg")) pkgManager = "pkg";
else if (checkDir("/usr/bin/apt-get")) pkgManager = "apt";

// Determine mode
let mode = "host-bootstrap";
if (runtimeRoot && assets.base && assets.bin) mode = "native-bundled";
else if (runtimeRoot || (assets.base && assets.bin)) mode = "mixed";

const bundleReady = !!(runtimeRoot && assets.base && assets.bin && assets.lib);

// Print summary
console.log("═══════════════════════════════════════════════");
console.log("  TerminAI Runtime Status");
console.log("═══════════════════════════════════════════════");
console.log("");

console.log("Environment:");
console.log(`  TERMINAI_WORKSPACE_ROOT:  ${process.env.TERMINAI_WORKSPACE_ROOT || "(not set)"}`);
console.log(`  TERMINAI_RUNTIME_ROOT:   ${process.env.TERMINAI_RUNTIME_ROOT || "(not set)"}`);
console.log(`  TERMINAI_AUTO_BOOTSTRAP: ${process.env.TERMINAI_AUTO_BOOTSTRAP || "false"}`);
console.log("");

console.log("Package Baseline:");
console.log(`  Packages: ${packageList.length}`);
console.log(`  Required: ${packageList.filter(p => p.required).length}`);
console.log(`  Install by default: ${packageList.filter(p => p.installByDefault !== false).length}`);
console.log("");

console.log("API Baseline:");
console.log(`  Capabilities: ${apiBaseline?.capabilities?.length ?? 0}`);
console.log(`  Available:    ${apiBaseline?.capabilities?.filter(c => c.status === "available").length ?? 0}`);
console.log(`  Simulated:    ${apiBaseline?.capabilities?.filter(c => c.status === "simulated").length ?? 0}`);
console.log(`  Unavailable:  ${apiBaseline?.capabilities?.filter(c => c.status === "unavailable").length ?? 0}`);
console.log("");

console.log("Runtime Bundle:");
console.log(`  Bundle:    ${runtimeBundle?.bundleName ?? "none"} v${runtimeBundle?.bundleVersion ?? "?"}`);
console.log(`  Mode:      ${mode}`);
console.log(`  Ready:     ${bundleReady ? "YES" : "NO"}`);
console.log(`  Root:      ${runtimeRoot || "(not set)"}`);
console.log(`  Assets:    ${assets.base ? "present" : "missing"} (bin=${assets.bin}, lib=${assets.lib}, etc=${assets.etc}, home=${assets.home})`);
console.log("");

console.log("Runtime State:");
if (runtimeState) {
  console.log(`  First run:    ${runtimeState.firstRunCompleted ? "complete" : "pending"}`);
  console.log(`  Ready:        ${runtimeState.runtimeReady ? "YES" : "NO"}`);
  console.log(`  Mode:         ${runtimeState.bootstrapMode}`);
  console.log(`  Pkg manager:  ${runtimeState.detectedPackageManager}`);
  console.log(`  Installed:    ${runtimeState.installedCount}/${runtimeState.installedCount + runtimeState.missingCount}`);
  console.log(`  Last check:   ${runtimeState.lastBootstrapCheck || "never"}`);
  console.log(`  Last install: ${runtimeState.lastBootstrapInstall || "never"}`);
} else {
  console.log("  (no state file — run the server first)");
}
console.log("");

console.log("═══════════════════════════════════════════════");
