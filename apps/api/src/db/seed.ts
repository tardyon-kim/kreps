import { scryptSync } from "node:crypto";
import { defaultRolePermissions, permissions, roles } from "@kreps/shared";
import postgres from "postgres";
import { getDatabaseUrl } from "./client.js";
import { isMainModule } from "./run-main.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";

const seedIds = {
  englishWorkItemId: "00000000-0000-4000-8000-000000000302",
  koreanWorkItemCreatedHistoryId: "00000000-0000-4000-8000-000000000401",
  englishWorkItemCreatedHistoryId: "00000000-0000-4000-8000-000000000402",
  workOsGlossaryTermId: "00000000-0000-4000-8000-000000000501",
  workItemGlossaryTermId: "00000000-0000-4000-8000-000000000502",
  agentRunnerGlossaryTermId: "00000000-0000-4000-8000-000000000503",
} as const;

function passwordHash(password: string, saltLabel: string) {
  const salt = `kreps-seed:${saltLabel}`;
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function seed(databaseUrl = getDatabaseUrl(), env: Record<string, string | undefined> = process.env) {
  const client = postgres(databaseUrl, { max: 1 });
  const initialPassword = env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!";

  try {
    await client.begin(async (sql) => {
      await sql`
        WITH ranked_admin_global_roles AS (
          SELECT
            id,
            row_number() OVER (
              ORDER BY (organization_id IS NULL AND project_id IS NULL) DESC, created_at ASC, id ASC
            ) AS position
          FROM user_roles
          WHERE user_id = ${rbacFixtures.adminUserId}
            AND role_id = 'system_admin'
            AND scope = 'global'
        )
        DELETE FROM user_roles
        WHERE id IN (
          SELECT id FROM ranked_admin_global_roles WHERE position > 1
        )
      `;

      await sql`
        UPDATE user_roles
        SET organization_id = NULL, project_id = NULL
        WHERE user_id = ${rbacFixtures.adminUserId}
          AND role_id = 'system_admin'
          AND scope = 'global'
      `;

      await sql`
        DELETE FROM work_item_history
        WHERE id <> ${seedIds.koreanWorkItemCreatedHistoryId}
          AND work_item_id = ${rbacFixtures.workItemId}
          AND actor_id = ${rbacFixtures.adminUserId}
          AND action = 'created'
          AND after = '{"status":"registered"}'::jsonb
      `;

      await sql`
        DELETE FROM work_item_history
        WHERE id <> ${seedIds.englishWorkItemCreatedHistoryId}
          AND work_item_id = ${seedIds.englishWorkItemId}
          AND actor_id = ${rbacFixtures.managerUserId}
          AND action = 'created'
          AND after = '{"status":"assigned"}'::jsonb
      `;

      await sql`
        DELETE FROM glossary_terms
        WHERE id <> ${seedIds.workOsGlossaryTermId}
          AND scope = 'global'
          AND english_expression = 'Work OS'
      `;

      await sql`
        DELETE FROM glossary_terms
        WHERE id <> ${seedIds.workItemGlossaryTermId}
          AND scope = 'global'
          AND english_expression = 'Work Item'
      `;

      await sql`
        DELETE FROM glossary_terms
        WHERE id <> ${seedIds.agentRunnerGlossaryTermId}
          AND scope = 'global'
          AND english_expression = 'Agent Runner'
      `;

      await sql`
        INSERT INTO organizations (id, name, code, default_locale)
        VALUES (${rbacFixtures.rootOrganizationId}, '본사', 'HQ', 'ko')
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          code = excluded.code,
          default_locale = excluded.default_locale,
          updated_at = now()
      `;

      await sql`
        INSERT INTO organizations (id, parent_id, name, code, default_locale)
        VALUES (${rbacFixtures.childOrganizationId}, ${rbacFixtures.rootOrganizationId}, '제품팀', 'PRODUCT', 'ko')
        ON CONFLICT (id) DO UPDATE SET
          parent_id = excluded.parent_id,
          name = excluded.name,
          code = excluded.code,
          default_locale = excluded.default_locale,
          updated_at = now()
      `;

      await sql`
        INSERT INTO users (id, organization_id, email, display_name, password_hash, locale, theme, status)
        VALUES
          (${rbacFixtures.adminUserId}, ${rbacFixtures.rootOrganizationId}, 'admin@example.local', 'System Admin', ${passwordHash(initialPassword, rbacFixtures.adminUserId)}, 'ko', 'system', 'active'),
          (${rbacFixtures.managerUserId}, ${rbacFixtures.childOrganizationId}, 'manager@example.local', 'Work Manager', ${passwordHash("ChangeMe123!", rbacFixtures.managerUserId)}, 'ko', 'system', 'active'),
          (${rbacFixtures.employeeUserId}, ${rbacFixtures.childOrganizationId}, 'employee@example.local', 'Employee', ${passwordHash("ChangeMe123!", rbacFixtures.employeeUserId)}, 'en', 'system', 'active'),
          (${rbacFixtures.unrelatedUserId}, ${rbacFixtures.rootOrganizationId}, 'viewer@example.local', 'Viewer', ${passwordHash("ChangeMe123!", rbacFixtures.unrelatedUserId)}, 'en', 'system', 'active')
        ON CONFLICT (id) DO UPDATE SET
          organization_id = excluded.organization_id,
          email = excluded.email,
          display_name = excluded.display_name,
          password_hash = excluded.password_hash,
          locale = excluded.locale,
          theme = excluded.theme,
          status = excluded.status,
          updated_at = now()
      `;

      for (const role of roles) {
        await sql`
          INSERT INTO roles (id, name)
          VALUES (${role}, ${role})
          ON CONFLICT (id) DO UPDATE SET name = excluded.name
        `;
      }

      for (const permission of permissions) {
        await sql`
          INSERT INTO permissions (id, name)
          VALUES (${permission}, ${permission})
          ON CONFLICT (id) DO UPDATE SET name = excluded.name
        `;
      }

      for (const [role, rolePermissions] of Object.entries(defaultRolePermissions)) {
        for (const permission of rolePermissions) {
          await sql`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (${role}, ${permission})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      await sql`
        INSERT INTO projects (id, organization_id, manager_id, name, code, description, status)
        VALUES (${rbacFixtures.projectId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.managerUserId}, 'Work OS 도입', 'WORKOS', '사내 업무 통합 시스템 도입 프로젝트', 'active')
        ON CONFLICT (id) DO UPDATE SET
          organization_id = excluded.organization_id,
          manager_id = excluded.manager_id,
          name = excluded.name,
          code = excluded.code,
          description = excluded.description,
          status = excluded.status,
          updated_at = now()
      `;

      await sql`
        INSERT INTO user_roles (user_id, role_id, scope, organization_id, project_id)
        VALUES
          (${rbacFixtures.adminUserId}, 'system_admin', 'global', ${null}, ${null}),
          (${rbacFixtures.managerUserId}, 'work_manager', 'organization_tree', ${rbacFixtures.childOrganizationId}, ${null}),
          (${rbacFixtures.employeeUserId}, 'employee', 'own_related', ${rbacFixtures.childOrganizationId}, ${null}),
          (${rbacFixtures.unrelatedUserId}, 'viewer', 'organization_tree', ${rbacFixtures.rootOrganizationId}, ${null})
        ON CONFLICT ON CONSTRAINT user_roles_unique_scope_target DO NOTHING
      `;

      await sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES
          (${rbacFixtures.projectId}, ${rbacFixtures.managerUserId}, 'manager'),
          (${rbacFixtures.projectId}, ${rbacFixtures.employeeUserId}, 'member')
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO work_items (id, organization_id, project_id, requester_id, responsible_user_id, title, description, source_language, status, priority)
        VALUES
          (${rbacFixtures.workItemId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.projectId}, ${rbacFixtures.adminUserId}, ${rbacFixtures.managerUserId}, '업무 접수 흐름 정리', '대표/PM/직원이 요청하는 업무를 한곳에서 접수하고 배정합니다.', 'ko', 'registered', 'high'),
          (${seedIds.englishWorkItemId}, ${rbacFixtures.childOrganizationId}, ${rbacFixtures.projectId}, ${rbacFixtures.managerUserId}, ${rbacFixtures.managerUserId}, 'Prepare English onboarding flow', 'Validate that multilingual work items preserve their original language.', 'en', 'assigned', 'normal')
        ON CONFLICT (id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          source_language = excluded.source_language,
          status = excluded.status,
          priority = excluded.priority,
          updated_at = now()
      `;

      await sql`
        INSERT INTO work_item_assignees (work_item_id, user_id, role)
        VALUES
          (${rbacFixtures.workItemId}, ${rbacFixtures.employeeUserId}, 'assignee'),
          (${seedIds.englishWorkItemId}, ${rbacFixtures.employeeUserId}, 'assignee')
        ON CONFLICT DO NOTHING
      `;

      await sql`
        INSERT INTO work_item_history (id, work_item_id, actor_id, action, after)
        VALUES
          (${seedIds.koreanWorkItemCreatedHistoryId}, ${rbacFixtures.workItemId}, ${rbacFixtures.adminUserId}, 'created', '{"status":"registered"}'::jsonb),
          (${seedIds.englishWorkItemCreatedHistoryId}, ${seedIds.englishWorkItemId}, ${rbacFixtures.managerUserId}, 'created', '{"status":"assigned"}'::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          work_item_id = excluded.work_item_id,
          actor_id = excluded.actor_id,
          action = excluded.action,
          after = excluded.after
      `;

      await sql`
        INSERT INTO glossary_terms (id, source_term, korean_expression, english_expression, description, usage_example, scope, last_editor_id)
        VALUES
          (${seedIds.workOsGlossaryTermId}, 'Work OS', '업무 운영체계', 'Work OS', '회사 업무를 한곳에서 요청, 배정, 추적하는 시스템', 'Work OS에서 새 업무를 등록합니다.', 'global', ${rbacFixtures.adminUserId}),
          (${seedIds.workItemGlossaryTermId}, '업무 항목', '업무 항목', 'Work Item', '요청, 작업, 검토 이력을 가진 단위 업무', '업무 항목에 담당자를 배정합니다.', 'global', ${rbacFixtures.adminUserId}),
          (${seedIds.agentRunnerGlossaryTermId}, 'Agent Runner', '에이전트 실행기', 'Agent Runner', 'AI 에이전트 실행 경계를 별도로 관리하는 구성요소', 'Agent Runner는 기본 비활성화 상태입니다.', 'global', ${rbacFixtures.adminUserId})
        ON CONFLICT (id) DO UPDATE SET
          source_term = excluded.source_term,
          korean_expression = excluded.korean_expression,
          english_expression = excluded.english_expression,
          description = excluded.description,
          usage_example = excluded.usage_example,
          scope = excluded.scope,
          last_editor_id = excluded.last_editor_id,
          updated_at = now()
      `;

      await sql`
        INSERT INTO agent_settings (id, enabled, mode, timeout_ms, updated_by_id)
        VALUES ('default', false, 'noop', 120000, ${rbacFixtures.adminUserId})
        ON CONFLICT (id) DO UPDATE SET
          enabled = excluded.enabled,
          mode = excluded.mode,
          timeout_ms = excluded.timeout_ms,
          updated_by_id = excluded.updated_by_id,
          updated_at = now()
      `;
    });
  } finally {
    await client.end();
  }
}

if (isMainModule(import.meta.url)) {
  await seed();
}
