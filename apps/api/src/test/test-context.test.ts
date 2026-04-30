import { access } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createApiTestContext, createTestFileStorageDir, getRequiredTestDatabaseUrl } from "./test-context.js";

describe("API integration test context", () => {
  it("requires TEST_DATABASE_URL for database-backed tests", () => {
    expect(() => getRequiredTestDatabaseUrl({})).toThrow("TEST_DATABASE_URL is required");
  });

  it("creates an isolated temporary file storage directory", async () => {
    const dir = await createTestFileStorageDir();
    expect(dir).toContain("kreps-test-files-");
  });

  it("runs migration and seed hooks against the required test database", async () => {
    const migrate = vi.fn();
    const seed = vi.fn();

    const context = await createApiTestContext({
      env: { TEST_DATABASE_URL: "postgres://kreps:kreps_dev_password@localhost:5432/kreps_test" },
      migrate,
      seed,
    });

    expect(context.databaseUrl).toBe("postgres://kreps:kreps_dev_password@localhost:5432/kreps_test");
    expect(migrate).toHaveBeenCalledWith(context.databaseUrl);
    expect(seed).toHaveBeenCalledWith(context.databaseUrl);
    await access(context.fileStorageDir);

    await context.cleanup();

    await expect(access(context.fileStorageDir)).rejects.toThrow();
  });
});
