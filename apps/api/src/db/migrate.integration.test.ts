import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.js";
import { getRequiredTestDatabaseUrl } from "../test/test-context.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";

function databaseUrlWithName(databaseUrl: string, databaseName: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

describe("database migration compatibility", () => {
  const baseDatabaseUrl = getRequiredTestDatabaseUrl();
  const databaseName = `kreps_retrofit_${process.pid}_${Date.now()}`.toLowerCase();
  const retrofitDatabaseUrl = databaseUrlWithName(baseDatabaseUrl, databaseName);
  let maintenanceClient: postgres.Sql;

  beforeAll(async () => {
    maintenanceClient = postgres(databaseUrlWithName(baseDatabaseUrl, "postgres"), { max: 1 });
    await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await maintenanceClient.unsafe(`CREATE DATABASE ${databaseName}`);
  });

  afterAll(async () => {
    await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await maintenanceClient.end();
  });

  it("retrofits an older Task 3 user_roles primary key into scoped target uniqueness", async () => {
    const sql = postgres(retrofitDatabaseUrl, { max: 1 });

    try {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`
        CREATE TABLE organizations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          code text NOT NULL UNIQUE,
          default_locale text NOT NULL DEFAULT 'ko',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE users (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL REFERENCES organizations(id),
          email text NOT NULL UNIQUE,
          display_name text NOT NULL,
          password_hash text NOT NULL,
          locale text NOT NULL DEFAULT 'ko',
          theme text NOT NULL DEFAULT 'system',
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE roles (
          id text PRIMARY KEY,
          name text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE projects (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL REFERENCES organizations(id),
          manager_id uuid REFERENCES users(id),
          name text NOT NULL,
          code text NOT NULL,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE user_roles (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          scope text NOT NULL,
          organization_id uuid REFERENCES organizations(id),
          project_id uuid REFERENCES projects(id),
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, role_id, scope)
        )
      `;

      await migrate(retrofitDatabaseUrl);

      const firstProjectId = "00000000-0000-4000-8000-000000000901";
      const secondProjectId = "00000000-0000-4000-8000-000000000902";

      await sql`
        INSERT INTO organizations (id, name, code)
        VALUES (${rbacFixtures.childOrganizationId}, '제품팀', 'PRODUCT')
      `;
      await sql`
        INSERT INTO users (id, organization_id, email, display_name, password_hash)
        VALUES (${rbacFixtures.employeeUserId}, ${rbacFixtures.childOrganizationId}, 'retrofit-employee@example.local', 'Retrofit Employee', 'hash')
      `;
      await sql`INSERT INTO roles (id, name) VALUES ('project_manager', 'project_manager')`;
      await sql`
        INSERT INTO projects (id, organization_id, name, code)
        VALUES
          (${firstProjectId}, ${rbacFixtures.childOrganizationId}, 'Retrofit A', 'RETROFIT-A'),
          (${secondProjectId}, ${rbacFixtures.childOrganizationId}, 'Retrofit B', 'RETROFIT-B')
      `;

      await sql`
        INSERT INTO user_roles (user_id, role_id, scope, project_id)
        VALUES
          (${rbacFixtures.employeeUserId}, 'project_manager', 'project', ${firstProjectId}),
          (${rbacFixtures.employeeUserId}, 'project_manager', 'project', ${secondProjectId})
      `;

      await expect(sql`
        INSERT INTO user_roles (user_id, role_id, scope, project_id)
        VALUES (${rbacFixtures.employeeUserId}, 'project_manager', 'project', ${firstProjectId})
      `).rejects.toThrow();
    } finally {
      await sql.end();
    }
  });
});
