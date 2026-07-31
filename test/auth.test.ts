import { describe, expect, it } from "vitest";
import { createRequest } from "./helpers/request";
import { app } from "../server.ts";

const request = createRequest(app);
const TEST_API_KEY = process.env.TERMINAI_API_KEY || "test-api-key";

describe("Auth Middleware on live routes", () => {
  it("lets health through without credentials", async () => {
    const res = await request({
      method: "GET",
      path: "/api/health",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rejects a protected API route when no key is provided", async () => {
    const res = await request({
      method: "GET",
      path: "/api/system/stats",
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects a protected API route with the wrong key", async () => {
    const res = await request({
      method: "GET",
      path: "/api/system/stats",
      headers: { "x-api-key": "bad-key" },
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("allows a protected API route with valid auth", async () => {
    const res = await request({
      method: "GET",
      path: "/api/system/stats",
      headers: { "x-api-key": TEST_API_KEY },
    });
    expect(res.status).toBe(200);
  });
});
