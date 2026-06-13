import path from "node:path";

export function getWorkspaceRoot(explicitRoot = process.env.TERMINAI_WORKSPACE_ROOT, fallbackRoot = process.cwd()) {
  return path.resolve(explicitRoot || fallbackRoot);
}

export function resolveWorkspacePath(inputPath = ".", workspaceRoot = getWorkspaceRoot()) {
  if (typeof inputPath !== "string") {
    throw new Error("Workspace path must be a string");
  }

  const root = path.resolve(workspaceRoot);
  const candidate = path.resolve(root, inputPath || ".");
  const relative = path.relative(root, candidate);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return candidate;
  }

  throw new Error("Access Denied: Sandbox escape prevented.");
}

export function isInsideWorkspace(inputPath, workspaceRoot = getWorkspaceRoot()) {
  try {
    resolveWorkspacePath(inputPath, workspaceRoot);
    return true;
  } catch {
    return false;
  }
}
