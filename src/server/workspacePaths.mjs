import path from "node:path";
import fs from "node:fs";

export function getWorkspaceRoot(explicitRoot = process.env.TERMINAI_WORKSPACE_ROOT, fallbackRoot = process.cwd()) {
  return path.resolve(explicitRoot || fallbackRoot);
}

function assertInsideWorkspace(absoluteTargetPath, workspaceRoot) {
  let normalizedRoot;
  try {
    normalizedRoot = fs.realpathSync(workspaceRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      normalizedRoot = path.resolve(workspaceRoot);
    } else {
      throw error;
    }
  }

  let normalizedTarget = absoluteTargetPath;
  let remainder = absoluteTargetPath;
  while (remainder !== normalizedRoot && !path.relative(path.resolve(workspaceRoot), remainder).startsWith("..")) {
    try {
      normalizedTarget = fs.realpathSync(remainder);
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      const parent = path.dirname(remainder);
      if (parent === remainder) {
        break;
      }
      remainder = parent;
    }
  }

  const relative = path.relative(normalizedRoot, normalizedTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error("Access Denied: Sandbox escape prevented.");
}

export function resolveWorkspacePath(inputPath = ".", workspaceRoot = getWorkspaceRoot()) {
  if (typeof inputPath !== "string") {
    throw new Error("Workspace path must be a string");
  }

  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(root, inputPath || ".");
  assertInsideWorkspace(candidate, root);

  return candidate;
}

export function resolveWorkspacePathStrict(inputPath = ".", workspaceRoot = getWorkspaceRoot()) {
  if (typeof inputPath !== "string") {
    throw new Error("Workspace path must be a string");
  }

  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(root, inputPath || ".");
  assertInsideWorkspace(candidate, root);

  try {
    const real = fs.realpathSync(candidate);
    const realRoot = fs.realpathSync(root);
    assertInsideWorkspace(real, realRoot);
    return real;
  } catch (error) {
    const skippedCodes = new Set(["ENOENT"]);
    if (!skippedCodes.has(error?.code)) {
      throw error;
    }

    const parent = path.dirname(candidate);
    assertInsideWorkspace(parent, root);
    return candidate;
  }
}

export function isInsideWorkspace(inputPath, workspaceRoot = getWorkspaceRoot()) {
  try {
    resolveWorkspacePath(inputPath, workspaceRoot);
    return true;
  } catch {
    return false;
  }
}

export function isAllowedFile(targetPath, workspaceRoot = getWorkspaceRoot()) {
  try {
    const resolved = resolveWorkspacePath(targetPath, workspaceRoot);
    const canonical = fs.realpathSync(resolved);
    const workspaceCanonical = fs.realpathSync(workspaceRoot);
    return path.relative(workspaceCanonical, canonical) !== "" && !path.relative(workspaceCanonical, canonical).startsWith("..") && !path.isAbsolute(path.relative(workspaceCanonical, canonical)) && fs.statSync(canonical).isFile();
  } catch {
    return false;
  }
}
