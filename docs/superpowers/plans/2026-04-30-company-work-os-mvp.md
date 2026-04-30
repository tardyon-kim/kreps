# Company Work OS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable on-premise company Work OS that centralizes internal work requests, ownership, project work, comments, files, multilingual UI, translation review data, theme preferences, audit history, and deployment operations.

**Architecture:** Use a TypeScript monorepo with a React SPA frontend, a Fastify API backend, shared domain rules, and PostgreSQL as the source of truth. The API owns workflow, RBAC, audit history, file metadata, translation metadata, notification generation, and Agent Runner configuration; the web app stays fast and predictable through API-backed lists, detail panels, optimistic-safe mutations, and local design tokens. Deployment is Docker Compose based, with no CDN or runtime external network dependency.

**Tech Stack:** Node.js 22 LTS, pnpm workspaces, TypeScript, Fastify, Drizzle ORM, PostgreSQL 16, React, Vite, TanStack Router, TanStack Query, lucide-react, Vitest, Testing Library, Playwright, Docker Compose.

---

## Product Boundaries

This plan implements the 1st MVP of the approved Work OS direction. It intentionally does not implement advanced ERP, payroll, accounting, external SaaS sync, complex electronic approval routing, mobile apps, or automatic AI execution. It does create the data and UI foundations that make those extensions possible.

The first production-usable workflow is:

`login -> my work -> quick create work item -> classify/assign -> comment/file/update status -> review/complete -> audit history`

The first admin workflow is:

`login as admin -> manage organization/users/roles -> create project -> connect work items -> inspect dashboard/health`

The first multilingual workflow is:

`choose Korean or English UI -> create original-language content -> store source language -> add/review translation -> maintain glossary terms`

## Repository And File Structure

Create the project as a monorepo:

- `package.json`: root workspace scripts for install, build, test, lint, db, compose, and release checks.
- `pnpm-workspace.yaml`: workspace package list.
- `tsconfig.base.json`: shared strict TypeScript config.
- `.editorconfig`: consistent text formatting.
- `.env.example`: complete non-secret environment template.
- `apps/api`: Fastify API service.
- `apps/web`: Vite React web app.
- `packages/shared`: shared enums, schemas, workflow rules, permission rules, i18n keys, and API DTO types.
- `infra/compose.yml`: on-prem Docker Compose stack.
- `infra/nginx/default.conf`: internal reverse proxy config for local/on-prem use.
- `scripts/dev.ps1`: starts local development services on Windows.
- `scripts/test.ps1`: runs local verification in one command.
- `scripts/backup.ps1`: creates PostgreSQL and file-storage backups.
- `scripts/restore.ps1`: restores a backup into a named environment.
- `scripts/release-package.ps1`: creates an offline-friendly release folder.
- `docs/operations/onprem-install.md`: operator installation guide.
- `docs/operations/backup-restore.md`: backup and restore guide.
- `docs/architecture/adr-0001-tech-stack.md`: records the stack decision.

## Domain Decisions

Use these canonical values in `packages/shared` and map UI labels through translation resources:

```ts
export const workStatuses = [
  "draft",
  "registered",
  "awaiting_review",
  "approved",
  "assigned",
  "in_progress",
  "on_hold",
  "completion_reported",
  "rejected",
  "completed",
  "cancelled",
] as const;

export const workStatusGroups = {
  waiting: ["draft", "registered", "awaiting_review", "approved", "assigned"],
  active: ["in_progress"],
  review: ["completion_reported"],
  done: ["completed", "cancelled"],
  blocked: ["on_hold", "rejected"],
} as const;

export const permissions = [
  "users.manage",
  "organizations.manage",
  "roles.manage",
  "work.create",
  "work.approve",
  "work.assign",
  "work.changeStatus",
  "work.close",
  "projects.create",
  "projects.manageMembers",
  "files.attach",
  "comments.create",
  "reports.view",
  "audit.view",
  "glossary.manage",
] as const;

export const scopes = ["global", "organization_tree", "project", "own_related"] as const;
```

The default roles are `system_admin`, `organization_admin`, `work_manager`, `project_manager`, `employee`, and `viewer`.

The initial UI locales are `ko` and `en`. Locale fallback order is:

`user.locale -> organization.defaultLocale -> "ko"`

The initial themes are `system`, `light`, and `dark`.

## Task 1: Repository Scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `.gitattributes`
- Create: `.env.example`
- Create: `docs/architecture/adr-0001-tech-stack.md`

- [ ] **Step 1: Create root workspace files**

Create `package.json` with these scripts:

```json
{
  "name": "kreps-work-os",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=22 <23",
    "pnpm": ">=10 <11"
  },
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --filter @kreps/api dev & pnpm --filter @kreps/web dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @kreps/web test:e2e",
    "typecheck": "pnpm -r typecheck",
    "db:generate": "pnpm --filter @kreps/api db:generate",
    "db:migrate": "pnpm --filter @kreps/api db:migrate",
    "db:seed": "pnpm --filter @kreps/api db:seed",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "compose:up": "docker compose -f infra/compose.yml up -d",
    "compose:down": "docker compose -f infra/compose.yml down"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 2: Create environment template**

Create `.env.example`:

```dotenv
NODE_ENV=development
APP_ORIGIN=http://localhost:5173
API_ORIGIN=http://localhost:3000
DATABASE_URL=postgres://kreps:kreps_dev_password@localhost:5432/kreps
SESSION_SECRET=replace-with-at-least-32-random-characters
FILE_STORAGE_DIR=./storage/files
MAX_UPLOAD_BYTES=26214400
DEFAULT_LOCALE=ko
DEFAULT_TIME_ZONE=Asia/Seoul
AGENT_RUNNER_ENABLED=false
AGENT_RUNNER_URL=
AGENT_RUNNER_TIMEOUT_MS=120000
```

- [ ] **Step 3: Create ADR**

Create `docs/architecture/adr-0001-tech-stack.md` with:

```markdown
# ADR 0001: Initial Work OS Technology Stack

## Status

Accepted on 2026-04-30.

## Decision

Use a TypeScript monorepo with React/Vite for the web client, Fastify for the API, Drizzle ORM for PostgreSQL access, and Docker Compose for on-premise deployment.

## Rationale

The system must run on an internal network, avoid runtime CDN dependencies, support future Gitea migration, and remain easy to deploy by copying a release package to a company server. A split web/API structure keeps the UI responsive and lets the API own audit, RBAC, workflow, and file rules. Drizzle keeps database migrations explicit and reviewable.

## Consequences

All build, test, database, backup, and release commands must be local scripts, so GitHub Actions and Gitea Actions can both call the same commands. The web app must bundle all static assets. The API must keep AI/Agent Runner integration behind configuration and safe disabled defaults.
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
corepack enable
pnpm install
```

Expected: `pnpm-lock.yaml` is created and no package install errors remain.

- [ ] **Step 5: Commit scaffold**

Run:

```powershell
git add package.json pnpm-workspace.yaml tsconfig.base.json .editorconfig .gitattributes .env.example docs/architecture/adr-0001-tech-stack.md pnpm-lock.yaml
git commit -m "chore: scaffold Work OS monorepo"
```

## Task 2: Shared Domain Package

**Files:**

- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/workflow.ts`
- Create: `packages/shared/src/workflow.test.ts`
- Create: `packages/shared/src/permissions.ts`
- Create: `packages/shared/src/permissions.test.ts`
- Create: `packages/shared/src/i18n.ts`
- Create: `packages/shared/src/i18n.test.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing workflow tests**

Create `packages/shared/src/workflow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canTransitionWorkStatus, getWorkStatusGroup } from "./workflow";

describe("work item workflow", () => {
  it("allows a simple work item to move from registered to assigned", () => {
    expect(canTransitionWorkStatus("registered", "assigned")).toBe(true);
  });

  it("does not allow a rejected work item to become completed directly", () => {
    expect(canTransitionWorkStatus("rejected", "completed")).toBe(false);
  });

  it("groups completion_reported as review", () => {
    expect(getWorkStatusGroup("completion_reported")).toBe("review");
  });
});
```

Run:

```powershell
pnpm --filter @kreps/shared test -- workflow.test.ts
```

Expected: FAIL because `workflow.ts` does not exist.

- [ ] **Step 2: Implement workflow constants and transition rules**

Create `packages/shared/src/workflow.ts` using the domain values from this plan. Define `canTransitionWorkStatus(from, to)` with these allowed transitions:

```ts
const allowedTransitions = {
  draft: ["registered", "cancelled"],
  registered: ["awaiting_review", "approved", "assigned", "on_hold", "rejected", "cancelled"],
  awaiting_review: ["approved", "rejected", "on_hold", "cancelled"],
  approved: ["assigned", "on_hold", "cancelled"],
  assigned: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completion_reported", "on_hold", "cancelled"],
  on_hold: ["registered", "assigned", "in_progress", "cancelled"],
  completion_reported: ["completed", "rejected", "in_progress"],
  rejected: ["registered", "cancelled"],
  completed: [],
  cancelled: [],
} as const;
```

- [ ] **Step 3: Write and implement permission tests**

Create tests that verify:

```ts
expect(roleHasPermission("system_admin", "audit.view")).toBe(true);
expect(roleHasPermission("employee", "work.create")).toBe(true);
expect(roleHasPermission("viewer", "work.changeStatus")).toBe(false);
expect(isValidScope("organization_tree")).toBe(true);
```

Implement `packages/shared/src/permissions.ts` with default role-permission mappings.

- [ ] **Step 4: Write and implement locale fallback tests**

Create tests that verify:

```ts
expect(resolveLocale({ userLocale: "en", organizationLocale: "ko", defaultLocale: "ko" })).toBe("en");
expect(resolveLocale({ userLocale: undefined, organizationLocale: "en", defaultLocale: "ko" })).toBe("en");
expect(resolveLocale({ userLocale: undefined, organizationLocale: undefined, defaultLocale: "ko" })).toBe("ko");
```

Implement `packages/shared/src/i18n.ts`.

- [ ] **Step 5: Verify and commit shared package**

Run:

```powershell
pnpm --filter @kreps/shared test
pnpm --filter @kreps/shared typecheck
git add packages/shared
git commit -m "feat: add shared Work OS domain rules"
```

Expected: tests pass, typecheck passes.

## Task 3: API Database Foundation

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/db/seed.ts`
- Create: `apps/api/src/db/schema.test.ts`

- [ ] **Step 1: Create API package and dependencies**

Use dependencies: `fastify`, `@fastify/cookie`, `@fastify/multipart`, `@fastify/static`, `drizzle-orm`, `postgres`, `zod`, `nanoid`, `@kreps/shared`.

Use dev dependencies: `typescript`, `tsx`, `vitest`, `drizzle-kit`, `@types/node`.

Scripts:

```json
{
  "dev": "tsx watch src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "test": "vitest run",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/db/migrate.ts",
  "db:seed": "tsx src/db/seed.ts"
}
```

- [ ] **Step 2: Write schema smoke test**

Create `apps/api/src/db/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  users,
  organizations,
  workItems,
  workItemHistory,
  projects,
  glossaryTerms,
} from "./schema";

describe("database schema", () => {
  it("defines core Work OS tables", () => {
    expect(users).toBeDefined();
    expect(organizations).toBeDefined();
    expect(workItems).toBeDefined();
    expect(workItemHistory).toBeDefined();
    expect(projects).toBeDefined();
    expect(glossaryTerms).toBeDefined();
  });
});
```

Run:

```powershell
pnpm --filter @kreps/api test -- schema.test.ts
```

Expected: FAIL because schema files are missing.

- [ ] **Step 3: Implement schema**

Create Drizzle tables for:

- `organizations`: `id`, `parentId`, `name`, `code`, `defaultLocale`, `createdAt`, `updatedAt`.
- `users`: `id`, `organizationId`, `email`, `displayName`, `passwordHash`, `locale`, `theme`, `status`, `createdAt`, `updatedAt`.
- `roles`, `permissions`, `rolePermissions`, `userRoles`.
- `projects`, `projectMembers`, `projectMilestones`.
- `workItems`, `workItemAssignees`, `workItemWatchers`, `workItemChecklists`.
- `comments`, `attachments`, `workItemHistory`.
- `contentTranslations`, `glossaryTerms`.
- `notifications`, `savedViews`.
- `agentSettings`, `agentRunRequests`.
- `sessions`.

Use UUID primary keys with database defaults. Use text enums from `packages/shared` values for status, priority, locale, theme, and scope.

- [ ] **Step 4: Implement seed**

Create a seed that inserts:

- Root organization: `본사`, code `HQ`, default locale `ko`.
- System admin user: email `admin@example.local`, display name `System Admin`, password from `INITIAL_ADMIN_PASSWORD` or `ChangeMe123!`.
- All default roles and permissions.
- One sample project: `Work OS 도입`.
- Two sample work items in Korean and English.
- Three glossary terms: `Work OS`, `업무 항목`, `Agent Runner`.

- [ ] **Step 5: Verify and commit database foundation**

Run:

```powershell
pnpm --filter @kreps/api test -- schema.test.ts
pnpm --filter @kreps/api typecheck
git add apps/api
git commit -m "feat: add database schema and seed foundation"
```

Expected: schema test and typecheck pass.

## Task 4: API App, Config, Health, And Audit

**Files:**

- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/health.test.ts`
- Create: `apps/api/src/audit/audit-log.ts`
- Create: `apps/api/src/audit/audit-log.test.ts`

- [ ] **Step 1: Write failing health route test**

Create a test that builds the Fastify app and calls `GET /health`:

```ts
const response = await app.inject({ method: "GET", url: "/health" });
expect(response.statusCode).toBe(200);
expect(response.json()).toMatchObject({
  status: "ok",
  database: "configured",
  fileStorage: "configured",
  agentRunner: "disabled",
});
```

Run:

```powershell
pnpm --filter @kreps/api test -- health.test.ts
```

Expected: FAIL because `buildApp` is missing.

- [ ] **Step 2: Implement config and app builder**

Implement `loadConfig(env)` with Zod validation for all `.env.example` keys. `AGENT_RUNNER_ENABLED=false` must produce `agentRunner: "disabled"` in health.

Implement `buildApp(config)` that registers JSON routes under `/api` and health at `/health`.

- [ ] **Step 3: Write and implement audit log helper**

Create an audit helper that records:

```ts
{
  actorUserId: string;
  action: string;
  targetType: "work_item" | "project" | "user" | "organization" | "role" | "system";
  targetId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
```

Test that updating a work item status produces an audit payload with `before.status` and `after.status`.

- [ ] **Step 4: Verify and commit API foundation**

Run:

```powershell
pnpm --filter @kreps/api test -- health.test.ts audit-log.test.ts
pnpm --filter @kreps/api typecheck
git add apps/api/src
git commit -m "feat: add API health and audit foundation"
```

## Task 5: Authentication And RBAC

**Files:**

- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/src/auth/password.test.ts`
- Create: `apps/api/src/auth/session.ts`
- Create: `apps/api/src/auth/session.test.ts`
- Create: `apps/api/src/auth/routes.ts`
- Create: `apps/api/src/auth/rbac.ts`
- Create: `apps/api/src/auth/rbac.test.ts`

- [ ] **Step 1: Write password hash tests**

Test that `hashPassword("ChangeMe123!")` produces a non-plain hash and `verifyPassword` accepts the right password and rejects a wrong one.

Use Node.js `crypto.scrypt` with a per-password random salt and constant-time comparison.

- [ ] **Step 2: Implement sessions**

Implement HTTP-only cookie sessions stored in the `sessions` table. Default cookie settings:

```ts
{
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
}
```

Test that `POST /api/auth/login` returns a session cookie and `GET /api/auth/me` returns the logged-in user.

- [ ] **Step 3: Implement RBAC guard**

Create `requirePermission(permission, scopeInput)` that checks role permissions and scope:

- `global` grants all records for that permission.
- `organization_tree` grants records in the user's organization subtree.
- `project` grants project member records.
- `own_related` grants requester, responsible user, assignee, watcher, or comment author records.

Write tests for `employee` and `work_manager` access to `work.changeStatus`.

- [ ] **Step 4: Verify and commit auth/RBAC**

Run:

```powershell
pnpm --filter @kreps/api test -- password.test.ts session.test.ts rbac.test.ts
pnpm --filter @kreps/api typecheck
git add apps/api/src/auth
git commit -m "feat: add authentication and RBAC"
```

## Task 6: Web App Shell, I18n, Theme, And Design Tokens

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/routes.tsx`
- Create: `apps/web/src/i18n/dictionaries.ts`
- Create: `apps/web/src/i18n/I18nProvider.tsx`
- Create: `apps/web/src/theme/theme.css`
- Create: `apps/web/src/theme/ThemeProvider.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/AppShell.test.tsx`
- Create: `apps/web/src/components/primitives/Button.tsx`
- Create: `apps/web/src/components/primitives/StatusBadge.tsx`

- [ ] **Step 1: Write failing app shell test**

Test that Korean renders `내 업무`, `업무 등록`, `전사 업무`, `프로젝트`, `승인`, `조직`, `용어집`, `설정`; English renders `My Work`, `New Work`, `All Work`, `Projects`, `Approvals`, `Organization`, `Glossary`, `Settings`.

Run:

```powershell
pnpm --filter @kreps/web test -- AppShell.test.tsx
```

Expected: FAIL because the app shell does not exist.

- [ ] **Step 2: Implement design tokens**

Create CSS variables for background, surface, border, text, muted text, primary, focus, danger, warning, success, info, and status badge colors. Define light and dark themes through `[data-theme="light"]` and `[data-theme="dark"]`. Do not use external fonts, CDN icons, decorative background images, or gradients.

- [ ] **Step 3: Implement app shell**

Use a fixed left sidebar, top bar with search, quick-create button, notification icon, language selector, theme selector, and user menu placeholder. Use `lucide-react` icons for navigation and icon buttons. The default route is `/my-work`.

- [ ] **Step 4: Verify and commit web foundation**

Run:

```powershell
pnpm --filter @kreps/web test -- AppShell.test.tsx
pnpm --filter @kreps/web typecheck
pnpm --filter @kreps/web build
git add apps/web
git commit -m "feat: add multilingual themed app shell"
```

## Task 7: Organization, Users, Roles

**Files:**

- Create: `apps/api/src/modules/organizations/organization.routes.ts`
- Create: `apps/api/src/modules/organizations/organization.service.ts`
- Create: `apps/api/src/modules/organizations/organization.test.ts`
- Create: `apps/api/src/modules/users/user.routes.ts`
- Create: `apps/api/src/modules/users/user.service.ts`
- Create: `apps/api/src/modules/users/user.test.ts`
- Create: `apps/web/src/features/organization/OrganizationPage.tsx`
- Create: `apps/web/src/features/settings/UserSettingsPage.tsx`

- [ ] **Step 1: Write API tests**

Test that:

- `GET /api/organizations/tree` returns nested organizations.
- `POST /api/organizations` requires `organizations.manage`.
- `GET /api/users` returns users with organization and roles.
- `PATCH /api/users/:id/preferences` allows the logged-in user to update `locale` and `theme`.

- [ ] **Step 2: Implement API routes and services**

Use Zod request schemas. Return `403` with `{ code: "permission_denied" }` when RBAC denies an action. Every organization/user mutation writes audit history.

- [ ] **Step 3: Implement web screens**

Organization page shows a tree and user list. Settings page allows language and theme selection. Changing language immediately changes sidebar labels without refresh.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm --filter @kreps/api test -- organization.test.ts user.test.ts
pnpm --filter @kreps/web test
pnpm verify
git add apps/api/src/modules apps/web/src/features
git commit -m "feat: add organization and user management"
```

## Task 8: Work Item Core Workflow

**Files:**

- Create: `apps/api/src/modules/work/work.routes.ts`
- Create: `apps/api/src/modules/work/work.service.ts`
- Create: `apps/api/src/modules/work/work.test.ts`
- Create: `apps/web/src/features/work/MyWorkPage.tsx`
- Create: `apps/web/src/features/work/AllWorkPage.tsx`
- Create: `apps/web/src/features/work/QuickCreateWorkDialog.tsx`
- Create: `apps/web/src/features/work/WorkDetailPanel.tsx`
- Create: `apps/web/src/features/work/WorkStatusBoard.tsx`
- Create: `apps/web/src/features/work/work.api.ts`

- [ ] **Step 1: Write API workflow tests**

Test that:

- `POST /api/work-items` creates a registered work item with requester, source language, status, priority, due date, and audit history.
- `GET /api/work-items?view=my` returns requester/responsible/assignee/watcher related items.
- `PATCH /api/work-items/:id/status` rejects invalid transitions from `rejected` to `completed`.
- `PATCH /api/work-items/:id/assignment` requires `work.assign`.
- `GET /api/work-items/:id/history` requires related access or `audit.view`.

- [ ] **Step 2: Implement work API**

Use the shared workflow transition rules. Store status changes in `workItemHistory` with actor, old status, new status, reason, and timestamp. Keep source title/description language separate from translated content.

- [ ] **Step 3: Implement web work views**

`MyWorkPage` shows today, awaiting review, due soon, translation needed, and overdue groups. `AllWorkPage` shows table filters for status, priority, organization, project, assignee, due date, and saved views. `WorkDetailPanel` supports status change, assignment, checklist, comments tab, files tab, translation tab, and history tab.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pnpm --filter @kreps/api test -- work.test.ts
pnpm --filter @kreps/web test
pnpm verify
git add apps/api/src/modules/work apps/web/src/features/work
git commit -m "feat: add work item workflow"
```

## Task 9: Projects, Comments, And Attachments

**Files:**

- Create: `apps/api/src/modules/projects/project.routes.ts`
- Create: `apps/api/src/modules/projects/project.service.ts`
- Create: `apps/api/src/modules/projects/project.test.ts`
- Create: `apps/api/src/modules/comments/comment.routes.ts`
- Create: `apps/api/src/modules/files/file.routes.ts`
- Create: `apps/api/src/modules/files/file-storage.ts`
- Create: `apps/web/src/features/projects/ProjectsPage.tsx`
- Create: `apps/web/src/features/projects/ProjectDetailPage.tsx`

- [ ] **Step 1: Write project API tests**

Test project create/update/member management, project work item linking, and project board grouping by work status group.

- [ ] **Step 2: Write comment/file API tests**

Test comment creation with source language, mention notification creation, file upload metadata, file size limit from `MAX_UPLOAD_BYTES`, and related work item/project access checks.

- [ ] **Step 3: Implement services**

Store files under `${FILE_STORAGE_DIR}/{targetType}/{targetId}/{attachmentId}` and store metadata in PostgreSQL. Do not execute uploaded files. Return downloads only after RBAC checks.

- [ ] **Step 4: Implement project web views**

Project list shows status, manager, period, member count, open work count, overdue count. Project detail includes overview, work list, board, milestones, files, and activity tabs.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @kreps/api test -- project.test.ts
pnpm verify
git add apps/api/src/modules/projects apps/api/src/modules/comments apps/api/src/modules/files apps/web/src/features/projects
git commit -m "feat: add projects comments and attachments"
```

## Task 10: Translation, Glossary, Notifications, Agent Settings

**Files:**

- Create: `apps/api/src/modules/translations/translation.routes.ts`
- Create: `apps/api/src/modules/translations/translation.service.ts`
- Create: `apps/api/src/modules/translations/translation.test.ts`
- Create: `apps/api/src/modules/glossary/glossary.routes.ts`
- Create: `apps/api/src/modules/glossary/glossary.test.ts`
- Create: `apps/api/src/modules/notifications/notification.routes.ts`
- Create: `apps/api/src/modules/agent/agent.routes.ts`
- Create: `apps/web/src/features/glossary/GlossaryPage.tsx`
- Create: `apps/web/src/features/notifications/NotificationsMenu.tsx`
- Create: `apps/web/src/features/agent/AgentStatusPanel.tsx`

- [ ] **Step 1: Write translation tests**

Test that:

- Original content remains unchanged after a translation is added.
- Translation status can move from `none` to `machine_translated` to `review_required` to `reviewed`.
- Editing original content marks existing translations as `stale`.
- Translation routes reject access to unrelated work items.

- [ ] **Step 2: Implement glossary**

Glossary entries include source term, Korean expression, English expression, description, usage example, scope, last editor, and last edited time. Glossary management requires `glossary.manage`; reading glossary is allowed to authenticated users.

- [ ] **Step 3: Implement notifications**

Create notification records for assignment, requested status change, approval request, due soon, overdue, comment mention, and project change. The MVP can use polling through `GET /api/notifications/unread`.

- [ ] **Step 4: Implement Agent Runner settings**

`GET /api/agent/status` returns:

```json
{
  "enabled": false,
  "mode": "noop",
  "message": "Agent Runner is disabled"
}
```

when `AGENT_RUNNER_ENABLED=false`. No Claude Code CLI execution is allowed in the main API process.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pnpm --filter @kreps/api test -- translation.test.ts glossary.test.ts
pnpm verify
git add apps/api/src/modules/translations apps/api/src/modules/glossary apps/api/src/modules/notifications apps/api/src/modules/agent apps/web/src/features/glossary apps/web/src/features/notifications apps/web/src/features/agent
git commit -m "feat: add translation glossary notifications and agent settings"
```

## Task 11: Dashboard, Saved Views, And Browser Verification

**Files:**

- Create: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.test.ts`
- Create: `apps/api/src/modules/saved-views/saved-view.routes.ts`
- Create: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/features/work/SavedViewsBar.tsx`
- Create: `apps/web/e2e/workflow.spec.ts`

- [ ] **Step 1: Write dashboard tests**

Test role-based dashboard summaries:

- employee: my requests, my work, approvals waiting, due soon.
- work manager: unclassified work, overdue work, unassigned work.
- project manager: project progress, blocked work, milestone risks.
- executive/system admin: all work volume, overdue status, project status, organization bottlenecks.

- [ ] **Step 2: Implement saved views**

Saved views store owner, name, route, filters, sort, columns, density, and default flag. A user can create, update, delete, and apply their own saved views.

- [ ] **Step 3: Implement Playwright E2E**

Create a browser test for:

```text
login -> change language to English -> switch dark theme -> quick create work item -> open detail panel -> assign -> move to in_progress -> add comment -> mark completion_reported -> verify history
```

- [ ] **Step 4: Verify desktop and mobile**

Run:

```powershell
pnpm --filter @kreps/web test:e2e
pnpm verify
```

Expected: E2E passes at desktop and mobile viewport sizes. Text must not overflow sidebar buttons, status badges, table headers, or detail panel actions in Korean or English.

- [ ] **Step 5: Commit dashboard and E2E**

Run:

```powershell
git add apps/api/src/modules/dashboard apps/api/src/modules/saved-views apps/web/src/features/dashboard apps/web/src/features/work/SavedViewsBar.tsx apps/web/e2e
git commit -m "feat: add dashboards saved views and e2e workflow"
```

## Task 12: On-Premise Deployment And Operations

**Files:**

- Create: `infra/compose.yml`
- Create: `infra/nginx/default.conf`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `scripts/dev.ps1`
- Create: `scripts/test.ps1`
- Create: `scripts/backup.ps1`
- Create: `scripts/restore.ps1`
- Create: `scripts/release-package.ps1`
- Create: `docs/operations/onprem-install.md`
- Create: `docs/operations/backup-restore.md`

- [ ] **Step 1: Create Compose stack**

Compose services:

- `postgres`: PostgreSQL 16 with named volume `kreps_postgres`.
- `api`: built from `apps/api/Dockerfile`, depends on postgres, mounts `kreps_files`.
- `web`: built from `apps/web/Dockerfile`, serves static files.
- `reverse-proxy`: nginx, exposes internal HTTP port, proxies `/api` and `/health` to API and all other routes to web.

Do not use CDN, external fonts, or external scripts.

- [ ] **Step 2: Create backup and restore scripts**

`scripts/backup.ps1` creates:

- PostgreSQL dump using `pg_dump`.
- File storage archive.
- A manifest containing app version, timestamp, database dump file, file archive, and SHA-256 hashes.

`scripts/restore.ps1` requires an explicit backup folder path and target database URL. It prints the target before restoring and refuses to run when the backup manifest is missing.

- [ ] **Step 3: Create release package script**

`scripts/release-package.ps1` creates `release/kreps-work-os-{git-sha}` containing:

- `infra/compose.yml`
- `.env.example`
- `scripts`
- `docs/operations`
- built web assets
- API build output
- `pnpm-lock.yaml`
- generated migration files

- [ ] **Step 4: Write operations docs**

`onprem-install.md` must include:

1. server prerequisites,
2. `.env` setup,
3. initial admin password handling,
4. `docker compose up -d`,
5. health check,
6. first login,
7. how to disable Agent Runner safely.

`backup-restore.md` must include:

1. backup command,
2. restore command,
3. backup storage permissions,
4. quarterly restore rehearsal recommendation,
5. verification checklist after restore.

- [ ] **Step 5: Verify and commit deployment**

Run:

```powershell
pnpm verify
docker compose -f infra/compose.yml config
git add infra apps/api/Dockerfile apps/web/Dockerfile scripts docs/operations
git commit -m "feat: add on-prem deployment and operations"
```

## Task 13: Final Release Readiness

**Files:**

- Modify: `README.md`
- Create: `docs/qa/mvp-acceptance-checklist.md`

- [ ] **Step 1: Create README**

README must include:

- product purpose,
- local development commands,
- test commands,
- migration and seed commands,
- deployment command,
- security and network assumptions,
- Gitea migration note.

- [ ] **Step 2: Create acceptance checklist**

Checklist items:

- login works,
- Korean and English UI work,
- light and dark themes work,
- admin can create organization and users,
- admin can assign roles,
- user can create work item,
- work manager can assign and change status,
- invalid status transition is rejected,
- project can link work items,
- comments and files respect permissions,
- translation preserves original content,
- glossary can be managed,
- notifications are generated,
- audit history records changes,
- health endpoint reports DB/files/agent status,
- Compose config validates,
- backup script creates manifest,
- restore script refuses invalid backup folder,
- app builds without external runtime assets.

- [ ] **Step 3: Run full verification**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @kreps/web test:e2e
docker compose -f infra/compose.yml config
```

Expected: all commands pass.

- [ ] **Step 4: Commit and tag MVP candidate**

Run:

```powershell
git add README.md docs/qa/mvp-acceptance-checklist.md
git commit -m "docs: add MVP acceptance checklist"
git tag mvp-0.1.0
```

Do not push the tag until the user confirms release tagging policy or the repository policy is documented.

## Self-Review

Spec coverage:

- Work hub, workflow, status model, comments, files, project linkage, and audit history are covered by Tasks 8 and 9.
- Employee, organization, role, permission, and scope foundations are covered by Tasks 3, 5, and 7.
- Korean/English UI, locale fallback, original content preservation, translation status, and glossary are covered by Tasks 2, 6, and 10.
- Quiet, fast, polished UI with app shell, sidebar, top bar, detail panel, status badges, saved views, dashboards, and responsive verification is covered by Tasks 6, 8, and 11.
- On-premise, restricted-network deployment, backup, restore, health checks, no runtime CDN, and GitHub/Gitea-neutral scripts are covered by Tasks 1, 12, and 13.
- Agent Runner is intentionally limited to disabled-safe configuration and status in Task 10, matching the 1st MVP boundary.

Placeholder scan:

- No task depends on unspecified external systems.
- No task asks workers to invent behavior without a test or a file target.
- Advanced approval routing, automatic AI execution, mobile app, ERP functions, and external SaaS sync remain outside this MVP by product decision.

Type consistency:

- Shared workflow values are defined once in `packages/shared`.
- API status transition logic imports shared rules instead of duplicating strings.
- Web labels use translation keys and shared values instead of hardcoded status text.

## Execution Handoff

Plan complete. Recommended execution order is Task 1 through Task 13 without parallel file edits during the initial scaffold. After Task 3, API and web work can proceed in parallel only when write ownership is split by `apps/api` and `apps/web`.
