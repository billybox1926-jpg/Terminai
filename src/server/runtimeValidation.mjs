import fs from "node:fs";
import path from "node:path";
import { splitAndSanitizePackageNames } from "./packageSanitizer.mjs";

const API_STATUS_VALUES = new Set(["available", "simulated", "unavailable"]);
const BOOTSTRAP_MODE_VALUES = new Set(["prompt-user", "auto", "disabled"]);
const PACKAGE_MANAGER_VALUES = new Set(["unknown", "apt", "pkg"]);
const RUNTIME_TARGET_MODES = new Set(["native-bundled", "host-package-manager", "mixed"]);
const ADAPTER_VALUES = new Set(["simulated", "android-native"]);
const INVOCATION_MODES = new Set(["allowlisted"]);
const PERMISSION_MODES = new Set(["explicit"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function fail(errors, message) {
  errors.push(message);
}

function requireObject(value, name, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(errors, `${name} must be an object`);
    return false;
  }
  return true;
}

function requireArray(value, name, errors) {
  if (!Array.isArray(value)) {
    fail(errors, `${name} must be an array`);
    return false;
  }
  return true;
}

function requireString(object, field, name, errors) {
  if (typeof object[field] !== "string" || object[field].trim() === "") {
    fail(errors, `${name}.${field} must be a non-empty string`);
    return false;
  }
  return true;
}

function requireBoolean(object, field, name, errors) {
  if (typeof object[field] !== "boolean") {
    fail(errors, `${name}.${field} must be a boolean`);
    return false;
  }
  return true;
}

function requireNumber(object, field, name, errors) {
  if (typeof object[field] !== "number" || !Number.isFinite(object[field])) {
    fail(errors, `${name}.${field} must be a finite number`);
    return false;
  }
  return true;
}

function validateUniqueIds(items, name, errors) {
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string") continue;
    if (seen.has(item.id)) fail(errors, `${name} has duplicate id: ${item.id}`);
    seen.add(item.id);
  }
}

export function validatePackageBaseline(value) {
  const errors = [];
  const packages = Array.isArray(value) ? value : value?.packages;
  if (!requireArray(packages, "package baseline", errors)) return errors;

  validateUniqueIds(packages, "package baseline", errors);

  packages.forEach((pkg, index) => {
    const name = `package baseline[${index}]`;
    if (!requireObject(pkg, name, errors)) return;
    for (const field of ["id", "displayName", "aptPackages", "termuxPackages", "queryCommand", "category", "description"]) {
      requireString(pkg, field, name, errors);
    }
    requireBoolean(pkg, "required", name, errors);
    requireBoolean(pkg, "installByDefault", name, errors);
    for (const field of ["id", "aptPackages", "termuxPackages"]) {
      if (typeof pkg[field] === "string") {
        try {
          splitAndSanitizePackageNames(pkg[field]);
        } catch (error) {
          fail(errors, `${name}.${field}: ${error.message}`);
        }
      }
    }
  });

  return errors;
}

export function validateApiBaseline(value) {
  const errors = [];
  if (!requireObject(value, "api baseline", errors)) return errors;
  requireString(value, "schema", "api baseline", errors);
  requireString(value, "description", "api baseline", errors);
  if (!requireArray(value.capabilities, "api baseline.capabilities", errors)) return errors;

  validateUniqueIds(value.capabilities, "api baseline.capabilities", errors);

  value.capabilities.forEach((capability, index) => {
    const name = `api baseline.capabilities[${index}]`;
    if (!requireObject(capability, name, errors)) return;
    for (const field of ["id", "displayName", "category", "description", "permission", "status"]) {
      requireString(capability, field, name, errors);
    }
    requireBoolean(capability, "nativeRequired", name, errors);
    if (typeof capability.status === "string" && !API_STATUS_VALUES.has(capability.status)) {
      fail(errors, `${name}.status has invalid value: ${capability.status}`);
    }
  });

  return errors;
}

export function validateRuntimeBundle(value, rootDir = process.cwd()) {
  const errors = [];
  if (!requireObject(value, "runtime bundle", errors)) return errors;
  for (const field of ["bundleName", "bundleVersion", "targetMode", "packageManifest", "apiManifest", "stateFile", "telemetryFile"]) {
    requireString(value, field, "runtime bundle", errors);
  }
  if (typeof value.targetMode === "string" && !RUNTIME_TARGET_MODES.has(value.targetMode)) {
    fail(errors, `runtime bundle.targetMode has invalid value: ${value.targetMode}`);
  }
  if (!requireArray(value.installRootCandidates, "runtime bundle.installRootCandidates", errors)) {
    return errors;
  }
  value.installRootCandidates.forEach((candidate, index) => {
    if (typeof candidate !== "string" || candidate.trim() === "") {
      fail(errors, `runtime bundle.installRootCandidates[${index}] must be a non-empty string`);
    }
  });

  if (requireObject(value.bootstrapStrategy, "runtime bundle.bootstrapStrategy", errors)) {
    for (const field of ["checkExisting", "preferBundled", "neverSilent"]) {
      requireBoolean(value.bootstrapStrategy, field, "runtime bundle.bootstrapStrategy", errors);
    }
    for (const field of ["fallbackTermux", "fallbackDebian"]) {
      requireString(value.bootstrapStrategy, field, "runtime bundle.bootstrapStrategy", errors);
    }
  }

  for (const field of ["packageManifest", "apiManifest"]) {
    if (typeof value[field] === "string") {
      const manifestPath = path.resolve(rootDir, value[field]);
      if (!fs.existsSync(manifestPath)) {
        fail(errors, `runtime bundle.${field} points to missing path: ${value[field]}`);
      }
    }
  }

  return errors;
}

export function validateApiBridgeContract(value, knownCapabilityIds = new Set(), rootDir = process.cwd()) {
  const errors = [];
  if (!requireObject(value, "api bridge contract", errors)) return errors;
  for (const field of ["bridgeName", "bridgeVersion", "apiManifest", "defaultAdapter", "futureNativeAdapter", "invocationMode", "permissionMode", "auditLogFile"]) {
    requireString(value, field, "api bridge contract", errors);
  }
  if (typeof value.defaultAdapter === "string" && !ADAPTER_VALUES.has(value.defaultAdapter)) {
    fail(errors, `api bridge contract.defaultAdapter has invalid value: ${value.defaultAdapter}`);
  }
  if (typeof value.futureNativeAdapter === "string" && !ADAPTER_VALUES.has(value.futureNativeAdapter)) {
    fail(errors, `api bridge contract.futureNativeAdapter has invalid value: ${value.futureNativeAdapter}`);
  }
  if (typeof value.invocationMode === "string" && !INVOCATION_MODES.has(value.invocationMode)) {
    fail(errors, `api bridge contract.invocationMode has invalid value: ${value.invocationMode}`);
  }
  if (typeof value.permissionMode === "string" && !PERMISSION_MODES.has(value.permissionMode)) {
    fail(errors, `api bridge contract.permissionMode has invalid value: ${value.permissionMode}`);
  }
  if (typeof value.apiManifest === "string" && !fs.existsSync(path.resolve(rootDir, value.apiManifest))) {
    fail(errors, `api bridge contract.apiManifest points to missing path: ${value.apiManifest}`);
  }

  if (requireObject(value.invocationCategories, "api bridge contract.invocationCategories", errors)) {
    for (const [categoryName, category] of Object.entries(value.invocationCategories)) {
      const name = `api bridge contract.invocationCategories.${categoryName}`;
      if (!requireObject(category, name, errors)) continue;
      requireString(category, "description", name, errors);
      requireBoolean(category, "permissionRequired", name, errors);
      if (requireArray(category.capabilities, `${name}.capabilities`, errors)) {
        category.capabilities.forEach((id, index) => {
          if (typeof id !== "string" || !knownCapabilityIds.has(id)) {
            fail(errors, `${name}.capabilities[${index}] references unknown capability id: ${id}`);
          }
        });
      }
    }
  }

  if (requireObject(value.allowlistedActions, "api bridge contract.allowlistedActions", errors)) {
    for (const [id, actions] of Object.entries(value.allowlistedActions)) {
      if (!knownCapabilityIds.has(id)) {
        fail(errors, `api bridge contract.allowlistedActions references unknown capability id: ${id}`);
      }
      if (requireArray(actions, `api bridge contract.allowlistedActions.${id}`, errors)) {
        actions.forEach((action, index) => {
          if (typeof action !== "string" || action.trim() === "") {
            fail(errors, `api bridge contract.allowlistedActions.${id}[${index}] must be a non-empty string`);
          }
        });
      }
    }
  }

  if (requireArray(value.blockedCapabilities, "api bridge contract.blockedCapabilities", errors)) {
    value.blockedCapabilities.forEach((id, index) => {
      if (typeof id !== "string" || !knownCapabilityIds.has(id)) {
        fail(errors, `api bridge contract.blockedCapabilities[${index}] references unknown capability id: ${id}`);
      }
    });
  }
  requireArray(value.notes, "api bridge contract.notes", errors);
  return errors;
}

export function validateRuntimeState(value) {
  const errors = [];
  if (!requireObject(value, "runtime state", errors)) return errors;
  for (const field of ["firstRunCompleted", "runtimeReady"]) requireBoolean(value, field, "runtime state", errors);
  for (const field of ["installedCount", "missingCount", "requiredMissingCount", "apiReadyCount", "apiSimulatedCount", "apiUnavailableCount"]) {
    requireNumber(value, field, "runtime state", errors);
  }
  requireString(value, "detectedPackageManager", "runtime state", errors);
  requireString(value, "bootstrapMode", "runtime state", errors);
  if (typeof value.detectedPackageManager === "string" && !PACKAGE_MANAGER_VALUES.has(value.detectedPackageManager)) {
    fail(errors, `runtime state.detectedPackageManager has invalid value: ${value.detectedPackageManager}`);
  }
  if (typeof value.bootstrapMode === "string" && !BOOTSTRAP_MODE_VALUES.has(value.bootstrapMode)) {
    fail(errors, `runtime state.bootstrapMode has invalid value: ${value.bootstrapMode}`);
  }
  return errors;
}

export function validateRuntimeBundleLock(value) {
  const errors = [];
  if (!requireObject(value, "runtime bundle lock", errors)) return errors;
  for (const field of ["bundleName", "bundleVersion", "generatedAt", "assetRoot"]) {
    requireString(value, field, "runtime bundle lock", errors);
  }
  requireNumber(value, "fileCount", "runtime bundle lock", errors);
  requireNumber(value, "totalBytes", "runtime bundle lock", errors);
  if (!requireArray(value.files, "runtime bundle lock.files", errors)) return errors;

  const seen = new Set();
  value.files.forEach((file, index) => {
    const name = `runtime bundle lock.files[${index}]`;
    if (!requireObject(file, name, errors)) return;
    requireString(file, "path", name, errors);
    requireNumber(file, "size", name, errors);
    requireString(file, "sha256", name, errors);
    if (typeof file.path === "string") {
      if (!file.path.startsWith("/")) fail(errors, `${name}.path must start with /`);
      if (file.path.includes("..")) fail(errors, `${name}.path must not contain traversal segments`);
      if (seen.has(file.path)) fail(errors, `runtime bundle lock.files has duplicate path: ${file.path}`);
      seen.add(file.path);
    }
    if (typeof file.sha256 === "string" && !SHA256_PATTERN.test(file.sha256)) {
      fail(errors, `${name}.sha256 must be 64 lowercase hex characters`);
    }
  });

  if (typeof value.fileCount === "number" && Array.isArray(value.files) && value.fileCount !== value.files.length) {
    fail(errors, `runtime bundle lock.fileCount ${value.fileCount} does not match files length ${value.files.length}`);
  }
  return errors;
}

export function validateAllRuntimeManifests(manifests, rootDir = process.cwd()) {
  const errors = [];
  const apiErrors = validateApiBaseline(manifests.apiBaseline);
  errors.push(...validatePackageBaseline(manifests.packageBaseline).map((e) => `package-baseline.json: ${e}`));
  errors.push(...apiErrors.map((e) => `api-baseline.json: ${e}`));
  errors.push(...validateRuntimeBundle(manifests.runtimeBundle, rootDir).map((e) => `runtime-bundle.json: ${e}`));

  const knownCapabilityIds = new Set(
    Array.isArray(manifests.apiBaseline?.capabilities)
      ? manifests.apiBaseline.capabilities.map((capability) => capability.id)
      : []
  );
  errors.push(...validateApiBridgeContract(manifests.apiBridgeContract, knownCapabilityIds, rootDir).map((e) => `api-bridge-contract.json: ${e}`));
  errors.push(...validateRuntimeState(manifests.runtimeStateExample).map((e) => `runtime-state.example.json: ${e}`));
  errors.push(...validateRuntimeBundleLock(manifests.runtimeBundleLockExample).map((e) => `runtime-bundle.lock.example.json: ${e}`));
  return errors;
}
