import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

type TestContextOptions = {
  env?: Record<string, string | undefined>;
  migrate?: (databaseUrl: string) => Promise<void>;
  seed?: (databaseUrl: string) => Promise<void>;
};

export type DisposableTestDatabase = {
  databaseName: string;
  databaseUrl: string;
  cleanup: () => Promise<void>;
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

function databaseUrlWithName(databaseUrl: string, databaseName: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteDatabaseIdentifier(identifier: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(identifier)) {
    throw new Error(`Unsafe disposable database name: ${identifier}`);
  }

  return `"${identifier}"`;
}

export async function createDisposableTestDatabase(label = "api") {
  const baseDatabaseUrl = getRequiredTestDatabaseUrl();
  const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "");
  const databaseName = `kreps_${normalizedLabel || "api"}_${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const quotedDatabaseName = quoteDatabaseIdentifier(databaseName);
  const maintenanceClient = postgres(databaseUrlWithName(baseDatabaseUrl, "postgres"), {
    max: 1,
    onnotice: () => undefined,
  });

  try {
    await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS ${quotedDatabaseName} WITH (FORCE)`);
    await maintenanceClient.unsafe(`CREATE DATABASE ${quotedDatabaseName}`);
  } catch (error) {
    await maintenanceClient.end();
    throw error;
  }

  return {
    databaseName,
    databaseUrl: databaseUrlWithName(baseDatabaseUrl, databaseName),
    cleanup: async () => {
      try {
        await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS ${quotedDatabaseName} WITH (FORCE)`);
      } finally {
        await maintenanceClient.end();
      }
    },
  } satisfies DisposableTestDatabase;
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
