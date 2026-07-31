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
});
