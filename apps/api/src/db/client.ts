import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function getDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

export function createDatabaseClient(databaseUrl = getDatabaseUrl()) {
  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client, { schema });

  return {
    client,
    db,
    close: async () => {
      await client.end();
    },
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
