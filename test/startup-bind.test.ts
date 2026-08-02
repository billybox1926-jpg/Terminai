import { describe, expect, it } from "vitest";
import { assertSecureBind } from "../server.ts";

describe("Startup bind guard", () => {
  it("allows loopback binds without an API key", () => {
    expect(() => assertSecureBind("127.0.0.1")).not.toThrow();
    expect(() => assertSecureBind("::1")).not.toThrow();
    expect(() => assertSecureBind("localhost")).not.toThrow();
  });

  it("allows non-loopback binds when TERMINAI_API_KEY is set", () => {
    process.env.TERMINAI_API_KEY = "test-key";
    expect(() => assertSecureBind("0.0.0.0")).not.toThrow();
    expect(() => assertSecureBind("192.168.1.10")).not.toThrow();
    delete process.env.TERMINAI_API_KEY;
  });

  it("refuses non-loopback binds without an API key", () => {
    delete process.env.TERMINAI_API_KEY;
    expect(() => assertSecureBind("0.0.0.0")).toThrow(
      /Refusing to start: TERMINAI_API_KEY is required when TERMINAI_BIND_ADDRESS="0\.0\.0\.0" is not loopback/
    );
    expect(() => assertSecureBind("192.168.1.10")).toThrow(
      /Refusing to start: TERMINAI_API_KEY is required when TERMINAI_BIND_ADDRESS="192\.168\.1\.10" is not loopback/
    );
  });
});
