#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAllRuntimeManifests } from "../src/server/runtimeValidation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
}

const manifests = {
  packageBaseline: readJson("runtime/package-baseline.json"),
  apiBaseline: readJson("runtime/api-baseline.json"),
  runtimeBundle: readJson("runtime/runtime-bundle.json"),
  apiBridgeContract: readJson("runtime/api-bridge-contract.json"),
  runtimeStateExample: readJson("runtime/runtime-state.example.json"),
  runtimeBundleLockExample: readJson("runtime/runtime-bundle.lock.example.json")
};

const errors = validateAllRuntimeManifests(manifests, projectRoot);

if (errors.length > 0) {
  console.error("Runtime manifest validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Runtime manifest validation passed.");
