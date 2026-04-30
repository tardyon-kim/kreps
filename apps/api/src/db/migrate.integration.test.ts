import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { migrate } from "./migrate.js";
import { seed } from "./seed.js";
import { createDisposableTestDatabase, type DisposableTestDatabase } from "../test/test-context.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";

const legacyEnglishWorkItemId = "00000000-0000-4000-8000-000000000302";
const userGlossaryTermId = "00000000-0000-4000-8000-000000000903";
const editedLegacyGlossaryTermId = "00000000-0000-4000-8000-000000000904";

async function createLegacyTask3SeededDatabase(sql: postgres.Sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`
    CREATE TABLE organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
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
      description text,
      status text NOT NULL DEFAULT 'planned',
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
  await sql`
    CREATE TABLE work_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id),
      project_id uuid REFERENCES projects(id),
      requester_id uuid NOT NULL REFERENCES users(id),
      responsible_user_id uuid REFERENCES users(id),
      title text NOT NULL,
      description text,
      source_language text NOT NULL DEFAULT 'ko',
      status text NOT NULL DEFAULT 'registered',
      priority text NOT NULL DEFAULT 'normal',
      due_date timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE work_item_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      actor_id uuid REFERENCES users(id),
      action text NOT NULL,
      before jsonb NOT NULL DEFAULT '{}'::jsonb,
      after jsonb NOT NULL DEFAULT '{}'::jsonb,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE glossary_terms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_term text NOT NULL,
      korean_expression text NOT NULL,
      english_expression text NOT NULL,
      description text,
      usage_example text,
      scope text NOT NULL DEFAULT 'global',
      scope_ref_id uuid,
      last_editor_id uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    INSERT INTO organizations (id, parent_id, name, code, default_locale)
    VALUES
      (${rbacFixtures.rootOrganizationId}, ${null}, 'Headquarters', 'HQ', 'ko'),
      (${rbacFixtures.childOrganizationId}, ${rbacFixtures.rootOrganizationId}, 'Product Team', 'PRODUCT', 'ko')
  `;
  await sql`
    INSERT INTO users (id, organization_id, email, display_name, password_hash, locale, theme, status)
    VALUES
      (${rbacFixtures.adminUserId}, ${rbacFixtures.rootOrganizationId}, 'admin@example.local', 'System Admin', 'legacy-hash', 'ko', 'system', 'active'),
      (${rbacFixtures.managerUserId}, ${rbacFixtures.childOrganizationId}, 'manager@example.local', 'Work Manager', 'legacy-hash', 'ko', 'system', 'active'),
      (${rbacFixtures.employeeUserId}, ${rbacFixtures.childOrganizationId}, 'employee@example.local', 'Employee', 'legacy-hash', 'en', 'system', 'active'),
      (${rbacFixtures.unrelatedUserId}, ${rbacFixtures.rootOrganizationId}, 'viewer@example.local', 'Viewer', 'legacy-hash', 'en', 'system', 'active')
  `;
  await sql`
    INSERT INTO roles (id, name)
    VALUES
      ('system_admin', 'system_admin'),
      ('work_manager', 'work_manager'),
      ('employee', 'employee'),
      ('viewer', 'viewer')
  `;
  await sql`
    INSERT INTO projects (id, organization_id, manager_id, name, code, description, status)
    VALUES (${rbacFixtures.projectId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.managerUserId}, 'Work OS rollout', 'WORKOS', 'Legacy seed project', 'active')
  `;
  await sql`
    INSERT INTO user_roles (user_id, role_id, scope, organization_id)
    VALUES
      (${rbacFixtures.adminUserId}, 'system_admin', 'global', ${rbacFixtures.rootOrganizationId}),
      (${rbacFixtures.managerUserId}, 'work_manager', 'organization_tree', ${rbacFixtures.childOrganizationId}),
      (${rbacFixtures.employeeUserId}, 'employee', 'own_related', ${rbacFixtures.childOrganizationId}),
      (${rbacFixtures.unrelatedUserId}, 'viewer', 'organization_tree', ${rbacFixtures.rootOrganizationId})
  `;
  await sql`
    INSERT INTO work_items (id, organization_id, project_id, requester_id, responsible_user_id, title, description, source_language, status, priority)
    VALUES
      (${rbacFixtures.workItemId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.projectId}, ${rbacFixtures.adminUserId}, ${rbacFixtures.managerUserId}, 'Legacy Korean work item', 'Legacy seed description', 'ko', 'registered', 'high'),
      (${legacyEnglishWorkItemId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.projectId}, ${rbacFixtures.managerUserId}, ${rbacFixtures.managerUserId}, 'Prepare English onboarding flow', 'Legacy seed description', 'en', 'assigned', 'normal')
  `;
  await sql`
    INSERT INTO work_item_history (work_item_id, actor_id, action, after)
    VALUES
      (${rbacFixtures.workItemId}, ${rbacFixtures.adminUserId}, 'created', '{"status":"registered"}'::jsonb),
      (${legacyEnglishWorkItemId}, ${rbacFixtures.managerUserId}, 'created', '{"status":"assigned"}'::jsonb)
  `;
  await sql`
    INSERT INTO glossary_terms (id, source_term, korean_expression, english_expression, description, usage_example, scope, last_editor_id)
    VALUES
      (gen_random_uuid(), 'Work OS', '업무 운영체계', 'Work OS', '회사 업무를 한곳에서 요청, 배정, 추적하는 시스템', 'Work OS에서 새 업무를 등록합니다.', 'global', ${rbacFixtures.adminUserId}),
      (gen_random_uuid(), '업무 항목', '업무 항목', 'Work Item', '요청, 작업, 검토 이력을 가진 단위 업무', '업무 항목에 담당자를 배정합니다.', 'global', ${rbacFixtures.adminUserId}),
      (gen_random_uuid(), 'Agent Runner', '에이전트 실행기', 'Agent Runner', 'AI 에이전트 실행 경계를 별도로 관리하는 구성요소', 'Agent Runner는 기본 비활성화 상태입니다.', 'global', ${rbacFixtures.adminUserId}),
      (${userGlossaryTermId}, 'Internal Work OS', 'Custom Work OS', 'Work OS', 'User-created glossary term', 'Keep this row', 'global', ${rbacFixtures.adminUserId}),
      (${editedLegacyGlossaryTermId}, 'Work OS', '사용자 수정 업무 운영체계', 'Work OS', '회사 업무를 한곳에서 요청, 배정, 추적하는 시스템', 'Work OS에서 새 업무를 등록합니다.', 'global', ${rbacFixtures.adminUserId})
  `;
}

describe("database migration compatibility", () => {
  let disposableDatabase: DisposableTestDatabase;
  let retrofitDatabaseUrl: string;

  beforeAll(async () => {
    disposableDatabase = await createDisposableTestDatabase("retrofit");
    retrofitDatabaseUrl = disposableDatabase.databaseUrl;
  });

  afterAll(async () => {
    await disposableDatabase?.cleanup();
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
        VALUES (${rbacFixtures.childOrganizationId}, 'Product Team', 'PRODUCT')
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

  it("normalizes an older Task 3 seeded database after migration and reseeding", async () => {
    const legacyDatabase = await createDisposableTestDatabase("legacy_seed");
    const sql = postgres(legacyDatabase.databaseUrl, { max: 1 });

    try {
      await createLegacyTask3SeededDatabase(sql);
      await migrate(legacyDatabase.databaseUrl);
      await seed(legacyDatabase.databaseUrl);

      const [summary] = await sql<{
        admin_global_roles_count: number;
        admin_global_targetless_count: number;
        user_roles_without_ids_count: number;
        project_starts_at_column_count: number;
        project_ends_at_column_count: number;
        seeded_history_count: number;
        seeded_glossary_count: number;
        user_glossary_count: number;
        edited_legacy_glossary_count: number;
        organization_code_unique_indexes_count: number;
        users_email_unique_indexes_count: number;
      }[]>`
        SELECT
          (SELECT count(*)::int FROM user_roles WHERE user_id = ${rbacFixtures.adminUserId} AND role_id = 'system_admin' AND scope = 'global') AS admin_global_roles_count,
          (SELECT count(*)::int FROM user_roles WHERE user_id = ${rbacFixtures.adminUserId} AND role_id = 'system_admin' AND scope = 'global' AND organization_id IS NULL AND project_id IS NULL) AS admin_global_targetless_count,
          (SELECT count(*)::int FROM user_roles WHERE id IS NULL) AS user_roles_without_ids_count,
          (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'starts_at') AS project_starts_at_column_count,
          (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'ends_at') AS project_ends_at_column_count,
          (SELECT count(*)::int FROM work_item_history WHERE action = 'created' AND work_item_id IN (${rbacFixtures.workItemId}, ${legacyEnglishWorkItemId})) AS seeded_history_count,
          (SELECT count(*)::int FROM glossary_terms WHERE id IN ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000503')) AS seeded_glossary_count,
          (SELECT count(*)::int FROM glossary_terms WHERE id = ${userGlossaryTermId} AND english_expression = 'Work OS' AND description = 'User-created glossary term') AS user_glossary_count,
          (SELECT count(*)::int FROM glossary_terms WHERE id = ${editedLegacyGlossaryTermId} AND korean_expression = '사용자 수정 업무 운영체계') AS edited_legacy_glossary_count,
          (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'organizations' AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(code)%') AS organization_code_unique_indexes_count,
          (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'users' AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%(email)%') AS users_email_unique_indexes_count
      `;

      expect(summary).toEqual({
        admin_global_roles_count: 1,
        admin_global_targetless_count: 1,
        user_roles_without_ids_count: 0,
        project_starts_at_column_count: 1,
        project_ends_at_column_count: 1,
        seeded_history_count: 2,
        seeded_glossary_count: 3,
        user_glossary_count: 1,
        edited_legacy_glossary_count: 1,
        organization_code_unique_indexes_count: 1,
        users_email_unique_indexes_count: 1,
      });
    } finally {
      await sql.end();
      await legacyDatabase.cleanup();
    }
  });
});
