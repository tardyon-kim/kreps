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

export type Permission = (typeof permissions)[number];

export const roles = [
  "system_admin",
  "organization_admin",
  "work_manager",
  "project_manager",
  "employee",
  "viewer",
] as const;

export type Role = (typeof roles)[number];

export const scopes = ["global", "organization_tree", "project", "own_related"] as const;

export type Scope = (typeof scopes)[number];

const defaultRolePermissions: Record<Role, readonly Permission[]> = {
  system_admin: permissions,
  organization_admin: [
    "users.manage",
    "organizations.manage",
    "work.create",
    "work.assign",
    "work.changeStatus",
    "files.attach",
    "comments.create",
    "reports.view",
    "audit.view",
  ],
  work_manager: [
    "work.create",
    "work.approve",
    "work.assign",
    "work.changeStatus",
    "work.close",
    "files.attach",
    "comments.create",
    "reports.view",
    "audit.view",
  ],
  project_manager: [
    "work.create",
    "work.assign",
    "work.changeStatus",
    "projects.create",
    "projects.manageMembers",
    "files.attach",
    "comments.create",
    "reports.view",
  ],
  employee: ["work.create", "files.attach", "comments.create"],
  viewer: ["reports.view"],
};

export function roleHasPermission(role: Role, permission: Permission) {
  return defaultRolePermissions[role].includes(permission);
}

export function isValidScope(scope: string): scope is Scope {
  return (scopes as readonly string[]).includes(scope);
}
