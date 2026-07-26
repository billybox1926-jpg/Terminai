import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/server.routes.test.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
  },
  coverage: {
    provider: "v8",
    thresholds: {
      lines: 80,
      functions: 70,
      branches: 80,
      statements: 80,
    },
  },
});
