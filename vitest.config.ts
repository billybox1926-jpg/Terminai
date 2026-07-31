import { defineConfig } from "vitest/config";

process.env.TERMINAI_API_KEY = process.env.TERMINAI_API_KEY || "test-api-key";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 80,
        statements: 80,
      },
    },
  },
});