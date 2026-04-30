import { permissions, roles } from "@kreps/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { getRequiredTestDatabaseUrl } from "../test/test-context.js";

const runDatabaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;

runDatabaseTests("seeded PostgreSQL database", () => {
  let database: DatabaseClient;

  beforeAll(() => {
    database = createDatabaseClient(getRequiredTestDatabaseUrl());
  });

  afterAll(async () => {
    await database.close();
  });

  it("contains the baseline organization, RBAC data, work items, glossary, and disabled agent settings", async () => {
    const [summary] = await database.client<{
      organizations_count: number;
      roles_count: number;
      permissions_count: number;
      work_items_count: number;
      glossary_terms_count: number;
      agent_enabled: boolean;
      agent_mode: string;
      agent_run_requests_table: string | null;
    }[]>`
      SELECT
        (SELECT count(*)::int FROM organizations) AS organizations_count,
        (SELECT count(*)::int FROM roles) AS roles_count,
        (SELECT count(*)::int FROM permissions) AS permissions_count,
        (SELECT count(*)::int FROM work_items) AS work_items_count,
        (SELECT count(*)::int FROM glossary_terms) AS glossary_terms_count,
        (SELECT enabled FROM agent_settings WHERE id = 'default') AS agent_enabled,
        (SELECT mode FROM agent_settings WHERE id = 'default') AS agent_mode,
        to_regclass('public.agent_run_requests')::text AS agent_run_requests_table
    `;

    expect(summary).toEqual({
      organizations_count: 2,
      roles_count: roles.length,
      permissions_count: permissions.length,
      work_items_count: 2,
      glossary_terms_count: 3,
      agent_enabled: false,
      agent_mode: "noop",
      agent_run_requests_table: null,
    });
  });
});
