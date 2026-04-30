import {
  defaultRolePermissions,
  permissions as sharedPermissions,
  roles as sharedRoles,
  scopes as sharedScopes,
  supportedLocales,
  supportedThemes,
  workStatuses,
} from "@kreps/shared";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const workPriorities = ["low", "normal", "high", "urgent"] as const;
export const userStatuses = ["active", "disabled"] as const;
export const projectStatuses = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export const translationStatuses = ["none", "machine_translated", "review_required", "reviewed", "stale"] as const;
export const agentModes = ["noop"] as const;

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => organizations.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    defaultLocale: text("default_locale", { enum: supportedLocales }).notNull().default("ko"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("organizations_code_idx").on(table.code)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale", { enum: supportedLocales }).notNull().default("ko"),
    theme: text("theme", { enum: supportedThemes }).notNull().default("system"),
    status: text("status", { enum: userStatuses }).notNull().default("active"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const roles = pgTable("roles", {
  id: text("id", { enum: sharedRoles }).primaryKey(),
  name: text("name").notNull(),
  createdAt,
});

export const permissions = pgTable("permissions", {
  id: text("id", { enum: sharedPermissions }).primaryKey(),
  name: text("name").notNull(),
  createdAt,
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id", { enum: sharedRoles })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id", { enum: sharedPermissions })
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  managerId: uuid("manager_id").references(() => users.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  status: text("status", { enum: projectStatuses }).notNull().default("planned"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id", { enum: sharedRoles })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    scope: text("scope", { enum: sharedScopes }).notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    projectId: uuid("project_id").references(() => projects.id),
    createdAt,
  },
  (table) => [
    unique("user_roles_unique_scope_target")
      .on(table.userId, table.roleId, table.scope, table.organizationId, table.projectId)
      .nullsNotDistinct(),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const projectMilestones = pgTable("project_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  createdAt,
  updatedAt,
});

export const workItems = pgTable("work_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  projectId: uuid("project_id").references(() => projects.id),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id),
  responsibleUserId: uuid("responsible_user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  sourceLanguage: text("source_language", { enum: supportedLocales }).notNull().default("ko"),
  status: text("status", { enum: workStatuses }).notNull().default("registered"),
  priority: text("priority", { enum: workPriorities }).notNull().default("normal"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  index("work_items_status_idx").on(table.status),
  index("work_items_project_idx").on(table.projectId),
]);

export const workItemAssignees = pgTable(
  "work_item_assignees",
  {
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("assignee"),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.workItemId, table.userId, table.role] })],
);

export const workItemWatchers = pgTable(
  "work_item_watchers",
  {
    workItemId: uuid("work_item_id")
      .notNull()
      .references(() => workItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.workItemId, table.userId] })],
);

export const workItemChecklists = pgTable("work_item_checklists", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isDone: boolean("is_done").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt,
  updatedAt,
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  sourceLanguage: text("source_language", { enum: supportedLocales }).notNull().default("ko"),
  createdAt,
  updatedAt,
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedById: uuid("uploaded_by_id")
    .notNull()
    .references(() => users.id),
  createdAt,
});

export const workItemHistory = pgTable("work_item_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  workItemId: uuid("work_item_id")
    .notNull()
    .references(() => workItems.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  before: jsonb("before").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  after: jsonb("after").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  reason: text("reason"),
  createdAt,
});

export const contentTranslations = pgTable("content_translations", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldName: text("field_name").notNull(),
  locale: text("locale", { enum: supportedLocales }).notNull(),
  sourceLocale: text("source_locale", { enum: supportedLocales }).notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: translationStatuses }).notNull().default("review_required"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const glossaryTerms = pgTable("glossary_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceTerm: text("source_term").notNull(),
  koreanExpression: text("korean_expression").notNull(),
  englishExpression: text("english_expression").notNull(),
  description: text("description"),
  usageExample: text("usage_example"),
  scope: text("scope", { enum: sharedScopes }).notNull().default("global"),
  scopeRefId: uuid("scope_ref_id"),
  lastEditorId: uuid("last_editor_id").references(() => users.id),
  createdAt,
  updatedAt,
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt,
}, (table) => [index("notifications_user_unread_idx").on(table.userId, table.readAt)]);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  route: text("route").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  sort: jsonb("sort").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  columns: jsonb("columns").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  density: text("density").notNull().default("comfortable"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt,
  updatedAt,
});

export const agentSettings = pgTable("agent_settings", {
  id: text("id").primaryKey().default("default"),
  enabled: boolean("enabled").notNull().default(false),
  mode: text("mode", { enum: agentModes }).notNull().default("noop"),
  runnerUrl: text("runner_url"),
  timeoutMs: integer("timeout_ms").notNull().default(120000),
  updatedById: uuid("updated_by_id").references(() => users.id),
  updatedAt,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt,
});

export const seedableDefaultRolePermissions = defaultRolePermissions;
