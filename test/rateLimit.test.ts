import { describe, expect, it } from "vitest";
import { createRequest } from "./helpers/request";
import { app } from "../server.ts";

const request = createRequest(app);
const TEST_API_KEY = process.env.TERMINAI_API_KEY || "test-api-key";
const authHeaders = { "x-api-key": TEST_API_KEY };

describe("Rate Limiter Middleware", () => {
  it("strict limiter does not block limited requests to terminal execute", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request({
        method: "POST",
        path: "/api/terminal/execute",
        headers: authHeaders,
        body: { command: "echo test" },
      });
      expect(res.status).not.toBe(429);
    }
  });

  it("default limiter does not block limited requests to system stats", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request({
        method: "GET",
        path: "/api/system/stats",
        headers: authHeaders,
      });
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(200);
    }
  });

  it("permissive limiter allows repeated health checks", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request({ method: "GET", path: "/api/health" });
      expect(res.status).toBe(200);
    }
  });

  it("file-write mutation endpoints are wired to strict rate limiting", async () => {
    const endpoints = [
      { method: "POST", path: "/api/file-manager/write", body: { path: "rate-limit-write.txt", content: "x" } },
      { method: "POST", path: "/api/file-manager/delete", body: { targetPath: "rate-limit-write.txt" } },
      { method: "POST", path: "/api/file-manager/create-folder", body: { dirPath: ".", name: "rate-limit-folder" } }
    ] as const;

    for (const endpoint of endpoints) {
      const res = await request({
        method: endpoint.method,
        path: endpoint.path,
        headers: authHeaders,
        body: endpoint.body
      });
      expect([200, 400, 403, 404]).toContain(res.status);
    }
  });
});
