import { permissions, roles } from "@kreps/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { seed } from "./seed.js";
import { getRequiredTestDatabaseUrl } from "../test/test-context.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";

describe("seeded PostgreSQL database", () => {
  let database: DatabaseClient;

  beforeAll(() => {
    database = createDatabaseClient(getRequiredTestDatabaseUrl());
  });

  afterAll(async () => {
    await database?.close();
  });

  async function readSummary() {
    const [summary] = await database.client<{
      organizations_count: number;
      roles_count: number;
      permissions_count: number;
      work_items_count: number;
      work_item_history_count: number;
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
        (SELECT count(*)::int FROM work_item_history) AS work_item_history_count,
        (SELECT count(*)::int FROM glossary_terms) AS glossary_terms_count,
        (SELECT enabled FROM agent_settings WHERE id = 'default') AS agent_enabled,
        (SELECT mode FROM agent_settings WHERE id = 'default') AS agent_mode,
        to_regclass('public.agent_run_requests')::text AS agent_run_requests_table
    `;

    return summary;
  }

  it("contains the baseline organization, RBAC data, work items, glossary, and disabled agent settings", async () => {
    const summary = await readSummary();

    expect(summary).toEqual({
      organizations_count: 2,
      roles_count: roles.length,
      permissions_count: permissions.length,
      work_items_count: 2,
      work_item_history_count: 2,
      glossary_terms_count: 3,
      agent_enabled: false,
      agent_mode: "noop",
      agent_run_requests_table: null,
    });
  });

  it("keeps seed data idempotent when seed runs more than once", async () => {
    await seed(getRequiredTestDatabaseUrl());

    expect(await readSummary()).toMatchObject({
      work_items_count: 2,
      work_item_history_count: 2,
      glossary_terms_count: 3,
    });
  });

  it("updates the seeded admin password hash and does not collapse default hashes into one value", async () => {
    const [beforeRow] = await database.client<{ before_hash: string }[]>`
      SELECT password_hash AS before_hash FROM users WHERE id = ${rbacFixtures.adminUserId}
    `;
    expect(beforeRow).toBeDefined();

    await seed(getRequiredTestDatabaseUrl(), { INITIAL_ADMIN_PASSWORD: "RotatedSeed123!" });

    const [afterRow] = await database.client<{
      after_hash: string;
      distinct_hash_count: number;
    }[]>`
      SELECT
        (SELECT password_hash FROM users WHERE id = ${rbacFixtures.adminUserId}) AS after_hash,
        (SELECT count(DISTINCT password_hash)::int FROM users) AS distinct_hash_count
    `;
    expect(afterRow).toBeDefined();

    expect(afterRow?.after_hash).not.toBe(beforeRow?.before_hash);
    expect(afterRow?.distinct_hash_count).toBeGreaterThan(1);
  });

  it("allows the same scoped role on more than one project for one user", async () => {
    const rollback = new Error("rollback");

    try {
      await database.client.begin(async (sql) => {
        const firstProjectId = randomUUID();
        const secondProjectId = randomUUID();

        await sql`
          INSERT INTO projects (id, organization_id, manager_id, name, code, status)
          VALUES
            (${firstProjectId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.managerUserId}, 'Scoped Role Test A', ${`ROLE-A-${firstProjectId}`}, 'active'),
            (${secondProjectId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.managerUserId}, 'Scoped Role Test B', ${`ROLE-B-${secondProjectId}`}, 'active')
        `;

        await sql`
          INSERT INTO user_roles (user_id, role_id, scope, project_id)
          VALUES
            (${rbacFixtures.employeeUserId}, 'project_manager', 'project', ${firstProjectId}),
            (${rbacFixtures.employeeUserId}, 'project_manager', 'project', ${secondProjectId})
        `;

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
