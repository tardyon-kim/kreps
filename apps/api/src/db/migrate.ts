import postgres from "postgres";
import { getDatabaseUrl } from "./client.js";
import { isMainModule } from "./run-main.js";

export const migrationStatements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    name text NOT NULL,
    code text NOT NULL,
    default_locale text NOT NULL DEFAULT 'ko' CHECK (default_locale IN ('ko', 'en')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    locale text NOT NULL DEFAULT 'ko' CHECK (locale IN ('ko', 'en')),
    theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id text PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id text PRIMARY KEY,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id text NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    manager_id uuid REFERENCES users(id),
    name text NOT NULL,
    code text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope text NOT NULL CHECK (scope IN ('global', 'organization_tree', 'project', 'own_related')),
    organization_id uuid REFERENCES organizations(id),
    project_id uuid REFERENCES projects(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_roles_unique_scope_target UNIQUE NULLS NOT DISTINCT (user_id, role_id, scope, organization_id, project_id)
  )`,
  `ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS id uuid`,
  `UPDATE user_roles SET id = gen_random_uuid() WHERE id IS NULL`,
  `ALTER TABLE user_roles ALTER COLUMN id SET DEFAULT gen_random_uuid()`,
  `ALTER TABLE user_roles ALTER COLUMN id SET NOT NULL`,
  `DO $$
  DECLARE
    current_pkey_columns text[];
  BEGIN
    SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)
    INTO current_pkey_columns
    FROM pg_constraint constraint_row
    JOIN unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_row.conrelid
     AND attribute.attnum = key_column.attnum
    WHERE constraint_row.conrelid = 'user_roles'::regclass
      AND constraint_row.conname = 'user_roles_pkey';

    IF current_pkey_columns IS DISTINCT FROM ARRAY['id'] THEN
      IF current_pkey_columns IS NOT NULL THEN
        ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey;
      END IF;

      ALTER TABLE user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
    END IF;
  END $$`,
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'user_roles'::regclass
        AND conname = 'user_roles_unique_scope_target'
    ) THEN
      ALTER TABLE user_roles
        ADD CONSTRAINT user_roles_unique_scope_target
        UNIQUE NULLS NOT DISTINCT (user_id, role_id, scope, organization_id, project_id);
    END IF;
  END $$`,
  `CREATE TABLE IF NOT EXISTS project_members (
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS project_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    due_date timestamptz,
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS work_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    project_id uuid REFERENCES projects(id),
    requester_id uuid NOT NULL REFERENCES users(id),
    responsible_user_id uuid REFERENCES users(id),
    title text NOT NULL,
    description text,
    source_language text NOT NULL DEFAULT 'ko' CHECK (source_language IN ('ko', 'en')),
    status text NOT NULL DEFAULT 'registered' CHECK (status IN ('draft', 'registered', 'awaiting_review', 'approved', 'assigned', 'in_progress', 'on_hold', 'completion_reported', 'rejected', 'completed', 'cancelled')),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    due_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS work_item_assignees (
    work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'assignee',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, user_id, role)
  )`,
  `CREATE TABLE IF NOT EXISTS work_item_watchers (
    work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS work_item_checklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    title text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES users(id),
    body text NOT NULL,
    source_language text NOT NULL DEFAULT 'ko' CHECK (source_language IN ('ko', 'en')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    byte_size integer NOT NULL,
    storage_path text NOT NULL,
    uploaded_by_id uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS work_item_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES users(id),
    action text NOT NULL,
    before jsonb NOT NULL DEFAULT '{}'::jsonb,
    after jsonb NOT NULL DEFAULT '{}'::jsonb,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS content_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    field_name text NOT NULL,
    locale text NOT NULL CHECK (locale IN ('ko', 'en')),
    source_locale text NOT NULL CHECK (source_locale IN ('ko', 'en')),
    content text NOT NULL,
    status text NOT NULL DEFAULT 'review_required' CHECK (status IN ('none', 'machine_translated', 'review_required', 'reviewed', 'stale')),
    reviewer_id uuid REFERENCES users(id),
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS glossary_terms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_term text NOT NULL,
    korean_expression text NOT NULL,
    english_expression text NOT NULL,
    description text,
    usage_example text,
    scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'organization_tree', 'project', 'own_related')),
    scope_ref_id uuid,
    last_editor_id uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS saved_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    route text NOT NULL,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    sort jsonb NOT NULL DEFAULT '{}'::jsonb,
    columns jsonb NOT NULL DEFAULT '[]'::jsonb,
    density text NOT NULL DEFAULT 'comfortable',
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS agent_settings (
    id text PRIMARY KEY DEFAULT 'default',
    enabled boolean NOT NULL DEFAULT false,
    mode text NOT NULL DEFAULT 'noop' CHECK (mode IN ('noop')),
    runner_url text,
    timeout_ms integer NOT NULL DEFAULT 120000,
    updated_by_id uuid REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS organizations_code_idx ON organizations(code)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)`,
  `CREATE INDEX IF NOT EXISTS work_items_status_idx ON work_items(status)`,
  `CREATE INDEX IF NOT EXISTS work_items_project_idx ON work_items(project_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read_at)`,
] as const;

export async function migrate(databaseUrl = getDatabaseUrl()) {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    for (const statement of migrationStatements) {
      await client.unsafe(statement);
    }
  } finally {
    await client.end();
  }
}

if (isMainModule(import.meta.url)) {
  await migrate();
}
