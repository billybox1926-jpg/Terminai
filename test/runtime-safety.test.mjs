import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  sanitizePackageName,
  selectManifestPackages
} from "../src/server/packageSanitizer.mjs";
import {
  resolveWorkspacePath,
  isInsideWorkspace
} from "../src/server/workspacePaths.mjs";
import {
  validateAllRuntimeManifests,
  validateApiBaseline,
  validateRuntimeState,
  validateRuntimeBundle
} from "../src/server/runtimeValidation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function currentManifests() {
  return {
    packageBaseline: readJson("runtime/package-baseline.json"),
    apiBaseline: readJson("runtime/api-baseline.json"),
    runtimeBundle: readJson("runtime/runtime-bundle.json"),
    apiBridgeContract: readJson("runtime/api-bridge-contract.json"),
    runtimeStateExample: readJson("runtime/runtime-state.example.json"),
    runtimeBundleLockExample: readJson("runtime/runtime-bundle.lock.example.json")
  };
}

test("package sanitizer accepts lowercase letters numbers dot plus and hyphen", () => {
  assert.equal(sanitizePackageName("git"), "git");
  assert.equal(sanitizePackageName("libssl1.1"), "libssl1.1");
  assert.equal(sanitizePackageName("c++-tool"), "c++-tool");
  assert.equal(sanitizePackageName("NodeJS"), "nodejs");
});

test("package sanitizer rejects shell metacharacters and path-like names", () => {
  assert.throws(() => sanitizePackageName("git;rm-rf"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("../git"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("git name"), /Invalid package name/);
  assert.throws(() => sanitizePackageName("$git"), /Invalid package name/);
});

test("unknown package IDs are rejected before install command generation", () => {
  const baseline = [{ id: "git", aptPackages: "git" }];
  assert.deepEqual(selectManifestPackages(["git"], baseline), ["git"]);
  assert.throws(() => selectManifestPackages(["missing"], baseline), /Unknown package: missing/);
});

test("workspace path resolver allows only paths inside the workspace root", () => {
  const root = path.join(projectRoot, "workspace-root");
  assert.equal(resolveWorkspacePath("subdir/file.txt", root), path.resolve(root, "subdir/file.txt"));
  assert.equal(resolveWorkspacePath(".", root), path.resolve(root));
  assert.throws(() => resolveWorkspacePath("../outside.txt", root), /Sandbox escape/);
  assert.equal(isInsideWorkspace("nested/file.txt", root), true);
  assert.equal(isInsideWorkspace("../../outside.txt", root), false);
});

test("runtime manifest validation passes for current manifests", () => {
  const errors = validateAllRuntimeManifests(currentManifests(), projectRoot);
  assert.deepEqual(errors, []);
});

test("runtime manifest validation fails on malformed sample objects", () => {
  assert.match(validateApiBaseline({ schema: "x", description: "x", capabilities: [{ id: "battery", status: "bogus" }] }).join("\n"), /invalid value/);
  assert.match(validateRuntimeState({ bootstrapMode: "silent" }).join("\n"), /bootstrapMode has invalid value/);
  assert.match(validateRuntimeBundle({
    bundleName: "terminai-runtime",
    bundleVersion: "0.1.0",
    targetMode: "native-bundled",
    packageManifest: "runtime/missing-package-baseline.json",
    apiManifest: "runtime/api-baseline.json",
    stateFile: "state.json",
    telemetryFile: "telemetry.json",
    installRootCandidates: ["./runtime"],
    bootstrapStrategy: {
      checkExisting: true,
      preferBundled: true,
      fallbackTermux: "pkg",
      fallbackDebian: "apt-get",
      neverSilent: true
    }
  }, projectRoot).join("\n"), /missing path/);
});
