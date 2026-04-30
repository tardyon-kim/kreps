import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type TestContextOptions = {
  env?: Record<string, string | undefined>;
  migrate?: (databaseUrl: string) => Promise<void>;
  seed?: (databaseUrl: string) => Promise<void>;
};

export function getRequiredTestDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const value = env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error("TEST_DATABASE_URL is required for API integration tests");
  }
  return value;
}

export async function createTestFileStorageDir() {
  return mkdtemp(join(tmpdir(), "kreps-test-files-"));
}

export async function createApiTestContext(options: TestContextOptions = {}) {
  const env = options.env ?? process.env;
  const databaseUrl = getRequiredTestDatabaseUrl(env);
  const fileStorageDir = await createTestFileStorageDir();
  await options.migrate?.(databaseUrl);
  await options.seed?.(databaseUrl);

  return {
    databaseUrl,
    fileStorageDir,
    cleanup: async () => {
      await rm(fileStorageDir, { recursive: true, force: true });
    },
  };
}
