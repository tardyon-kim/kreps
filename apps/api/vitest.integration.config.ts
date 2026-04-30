import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    pool: "threads",
    isolate: true,
    passWithNoTests: true,
    testTimeout: 30000,
  },
});
