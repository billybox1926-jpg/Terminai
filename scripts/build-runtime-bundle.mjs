#!/usr/bin/env node
/**
 * scripts/build-runtime-bundle.mjs
 *
 * Builds a runtime bundle lock file by scanning runtime/assets/ and computing
 * SHA-256 checksums for every real file (ignoring .gitkeep).
 *
 * Outputs:
 *   runtime/runtime-bundle.lock.json  — lock file with checksums
 *   dist/terminai-runtime-manifest.json — copy of bundle manifest + lock summary
 *
 * Usage:
 *   node scripts/build-runtime-bundle.mjs
 *
 * Environment:
 *   PROJECT_ROOT — defaults to parent of scripts/
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const BUNDLE_PATH = path.join(PROJECT_ROOT, "runtime", "runtime-bundle.json");
const ASSETS_DIR = path.join(PROJECT_ROOT, "runtime", "assets");
const LOCK_PATH = path.join(PROJECT_ROOT, "runtime", "runtime-bundle.lock.json");
const DIST_MANIFEST_PATH = path.join(PROJECT_ROOT, "dist", "terminai-runtime-manifest.json");

// ── helpers ──────────────────────────────────────────────────────────

function readJSON(p) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    console.error(`  Error reading ${p}: ${e.message}`);
  }
  return null;
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function scanAssets(dir, baseDir = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanAssets(fullPath, baseDir));
    } else if (entry.isFile() && entry.name !== ".gitkeep") {
      const relPath = "/" + path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const stat = fs.statSync(fullPath);
      files.push({
        path: relPath,
        size: stat.size,
        sha256: sha256File(fullPath),
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

// ── main ──────────────────────────────────────────────────────────────

console.log("Building runtime bundle lock file...");
console.log(`  Project root: ${PROJECT_ROOT}`);
console.log(`  Assets dir:   ${ASSETS_DIR}`);

const bundle = readJSON(BUNDLE_PATH);
if (!bundle) {
  console.error("  ERROR: runtime/runtime-bundle.json not found. Aborting.");
  process.exit(1);
}

console.log(`  Bundle: ${bundle.bundleName} v${bundle.bundleVersion}`);

// Scan asset files
const files = scanAssets(ASSETS_DIR);
const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

console.log(`  Scanned: ${files.length} files, ${totalBytes} bytes`);

// Build lock file
const lock = {
  bundleName: bundle.bundleName,
  bundleVersion: bundle.bundleVersion,
  generatedAt: new Date().toISOString(),
  assetRoot: "runtime/assets",
  fileCount: files.length,
  totalBytes,
  files,
};

// Write lock file
fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
console.log(`  Written: ${LOCK_PATH}`);

// Build dist manifest
fs.mkdirSync(path.dirname(DIST_MANIFEST_PATH), { recursive: true });
const distManifest = {
  ...bundle,
  lockSummary: {
    fileCount: lock.fileCount,
    totalBytes: lock.totalBytes,
    generatedAt: lock.generatedAt,
  },
};
fs.writeFileSync(DIST_MANIFEST_PATH, JSON.stringify(distManifest, null, 2) + "\n");
console.log(`  Written: ${DIST_MANIFEST_PATH}`);

// Summary
console.log("\n  ✓ Runtime bundle lock file generated successfully.");
if (files.length === 0) {
  console.log("  NOTE: No real asset files found (only .gitkeep placeholders).");
  console.log("  This is expected before native bundled binaries are added.");
}
