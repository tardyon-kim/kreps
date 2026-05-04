import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAuditLogStore } from "../audit/audit-log.js";
import { createDatabaseClient, type DatabaseClient } from "../db/client.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";
import { createDisposableTestDatabase, type DisposableTestDatabase } from "../test/test-context.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";
import { PostgresOrganizationStore } from "./organizations/organization.service.js";
import { PostgresUserStore } from "./users/user.service.js";

describe("directory stores", () => {
  let disposableDatabase: DisposableTestDatabase;
  let database: DatabaseClient;

  beforeAll(async () => {
    disposableDatabase = await createDisposableTestDatabase("directory");
    await migrate(disposableDatabase.databaseUrl);
    await seed(disposableDatabase.databaseUrl);
    database = createDatabaseClient(disposableDatabase.databaseUrl);
  });

  afterAll(async () => {
    await database?.close();
    await disposableDatabase?.cleanup();
  });

  it("groups joined user role rows into one directory user per account", async () => {
    const noRoleUserId = randomUUID();
    await database.client`
      INSERT INTO users (id, organization_id, email, display_name, password_hash, locale, theme, status)
      VALUES (${noRoleUserId}, ${rbacFixtures.childOrganizationId}, 'no-role@example.local', 'No Role', 'hash', 'ko', 'system', 'active')
    `;
    await database.client`
      INSERT INTO user_roles (user_id, role_id, scope, organization_id)
      VALUES (${rbacFixtures.managerUserId}, 'organization_admin', 'organization_tree', ${rbacFixtures.childOrganizationId})
      ON CONFLICT ON CONSTRAINT user_roles_unique_scope_target DO NOTHING
    `;

    const users = await new PostgresUserStore(database.db).listUsers([rbacFixtures.childOrganizationId]);
    const manager = users.find((user) => user.id === rbacFixtures.managerUserId);
    const noRoleUser = users.find((user) => user.id === noRoleUserId);

    expect(users.filter((user) => user.id === rbacFixtures.managerUserId)).toHaveLength(1);
    expect(manager?.roles).toEqual([
      {
        roleId: "organization_admin",
        scope: "organization_tree",
        organizationId: rbacFixtures.childOrganizationId,
        projectId: null,
      },
      {
        roleId: "work_manager",
        scope: "organization_tree",
        organizationId: rbacFixtures.childOrganizationId,
        projectId: null,
      },
    ]);
    expect(noRoleUser).toMatchObject({
      email: "no-role@example.local",
      organization: { code: "PRODUCT" },
      roles: [],
    });
  });

  it("omits out-of-scope roles from scoped directory users", async () => {
    const visibleUserId = randomUUID();
    const siblingOrganizationId = randomUUID();
    const siblingProjectId = randomUUID();
    await database.client`
      INSERT INTO organizations (id, parent_id, name, code, default_locale)
      VALUES (${siblingOrganizationId}, ${rbacFixtures.rootOrganizationId}, 'Sibling Team', ${`SIB_${randomUUID().slice(0, 8).toUpperCase()}`}, 'en')
    `;
    await database.client`
      INSERT INTO projects (id, organization_id, name, code, status)
      VALUES (${siblingProjectId}, ${siblingOrganizationId}, 'Sibling Project', ${`SIBP_${randomUUID().slice(0, 8).toUpperCase()}`}, 'active')
    `;
    await database.client`
      INSERT INTO users (id, organization_id, email, display_name, password_hash, locale, theme, status)
      VALUES (${visibleUserId}, ${rbacFixtures.childOrganizationId}, ${`visible-${visibleUserId}@example.local`}, 'Visible User', 'hash', 'ko', 'system', 'active')
    `;
    await database.client`
      INSERT INTO user_roles (user_id, role_id, scope, organization_id, project_id)
      VALUES
        (${visibleUserId}, 'employee', 'own_related', ${rbacFixtures.childOrganizationId}, ${null}),
        (${visibleUserId}, 'project_manager', 'project', ${null}, ${rbacFixtures.projectId}),
        (${visibleUserId}, 'viewer', 'global', ${null}, ${null}),
        (${visibleUserId}, 'work_manager', 'organization_tree', ${siblingOrganizationId}, ${null}),
        (${visibleUserId}, 'project_manager', 'project', ${null}, ${siblingProjectId})
    `;

    const directoryUsers = await new PostgresUserStore(database.db).listUsers([rbacFixtures.childOrganizationId]);
    const visibleUser = directoryUsers.find((user) => user.id === visibleUserId);

    expect(visibleUser?.roles).toEqual([
      {
        roleId: "employee",
        scope: "own_related",
        organizationId: rbacFixtures.childOrganizationId,
        projectId: null,
      },
      {
        roleId: "project_manager",
        scope: "project",
        organizationId: null,
        projectId: rbacFixtures.projectId,
      },
    ]);
  });

  it("persists audit events with JSON before and after payloads", async () => {
    const targetId = randomUUID();
    await new PostgresAuditLogStore(database.db).recordAudit({
      actorUserId: rbacFixtures.adminUserId,
      action: "directory.tested",
      targetType: "system",
      targetId,
      before: { enabled: false },
      after: { enabled: true },
    });

    const [event] = await database.client<{
      actor_user_id: string;
      action: string;
      target_type: string;
      target_id: string;
      before: { enabled: boolean };
      after: { enabled: boolean };
      created_at: string;
    }[]>`
      SELECT actor_user_id, action, target_type, target_id, before, after, created_at
      FROM audit_events
      WHERE target_id = ${targetId}
    `;

    expect(event).toMatchObject({
      actor_user_id: rbacFixtures.adminUserId,
      action: "directory.tested",
      target_type: "system",
      target_id: targetId,
      before: { enabled: false },
      after: { enabled: true },
    });
    expect(Number.isNaN(Date.parse(event?.created_at ?? ""))).toBe(false);
  });

  it("rolls back organization creation when its audit insert fails", async () => {
    const code = `ROLLBACK_${randomUUID().slice(0, 8).toUpperCase()}`;
    await expect(
      new PostgresOrganizationStore(database.db).createOrganizationWithAudit(
        {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Rollback Test",
          code,
          defaultLocale: "ko",
        },
        {
          actorUserId: randomUUID(),
          action: "organization.created",
          targetType: "organization",
          targetId: "pending",
          before: {},
          after: { code },
        },
      ),
    ).rejects.toThrow();

    const [summary] = await database.client<{ count: number }[]>`
      SELECT count(*)::int FROM organizations WHERE code = ${code}
    `;
    expect(summary?.count).toBe(0);
  });

  it("rolls back preference updates when their audit insert fails", async () => {
    await expect(
      new PostgresUserStore(database.db).updateUserPreferencesWithAudit(
        rbacFixtures.employeeUserId,
        { locale: "ko", theme: "dark" },
        randomUUID(),
      ),
    ).rejects.toThrow();

    const [user] = await database.client<{ locale: string; theme: string }[]>`
      SELECT locale, theme FROM users WHERE id = ${rbacFixtures.employeeUserId}
    `;
    expect(user).toEqual({ locale: "en", theme: "system" });
  });
});
