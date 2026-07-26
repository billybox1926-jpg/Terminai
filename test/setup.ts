import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const TEST_ROOT = (() => {
  const uid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return path.join(os.tmpdir(), `terminai-test-${uid}`);
})();

export function ensureTestWorkspace(): void {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  fs.mkdirSync(path.join(TEST_ROOT, "runtime"), { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, "package.json"), JSON.stringify({ name: "terminai-test", private: true }, null, 2));
  fs.writeFileSync(path.join(TEST_ROOT, "runtime", "package-baseline.json"), JSON.stringify([
    { id: "echo", displayName: "Echo", aptPackages: "echo", queryCommand: "echo", category: "Utility", description: "Render-only baseline" }
  ], null, 2));
  fs.writeFileSync(path.join(TEST_ROOT, "runtime", "api-baseline.json"), JSON.stringify([], null, 2));
  fs.writeFileSync(path.join(TEST_ROOT, "runtime", "runtime-bundle.json"), JSON.stringify({ version: "test" }, null, 2));
  fs.writeFileSync(path.join(TEST_ROOT, "runtime", "runtime-bundle.lock.json"), JSON.stringify({ files: [] }, null, 2));
}

export function disposeTestWorkspace(): void {
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // best-effort teardown
  }
}

ensureTestWorkspace();
process.env.TERMINAI_AUTO_BOOTSTRAP = "false";
process.env.NODE_ENV = "test";
process.env.TERMINAI_WORKSPACE_ROOT = TEST_ROOT;
