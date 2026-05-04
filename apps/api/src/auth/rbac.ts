import { type Permission, type Role, type Scope, roleHasPermission } from "@kreps/shared";

export type RoleAssignment = {
  roleId: Role;
  scope: Scope;
  organizationId?: string | null;
  projectId?: string | null;
};

export type PermissionTarget = {
  organizationId?: string | null;
  projectId?: string | null;
  requesterId?: string | null;
  responsibleUserId?: string | null;
  assigneeIds?: readonly string[];
  watcherIds?: readonly string[];
  commentAuthorIds?: readonly string[];
};

export type PermissionScopeInput = {
  userId: string;
  roles: readonly RoleAssignment[];
  target: PermissionTarget;
  organizationTreeIdsByOrganizationId?: Readonly<Record<string, readonly string[]>>;
};

export type PermissionGrant = {
  permission: Permission;
  roleId: Role;
  scope: Scope;
  organizationId?: string | null;
  projectId?: string | null;
};

export class PermissionDeniedError extends Error {
  constructor(permission: Permission) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function requirePermission(permission: Permission, input: PermissionScopeInput): PermissionGrant {
  const [grant] = listPermissionGrants(permission, input);
  if (grant) return grant;

  throw new PermissionDeniedError(permission);
}

export function listPermissionGrants(permission: Permission, input: PermissionScopeInput): PermissionGrant[] {
  const grants: PermissionGrant[] = [];

  for (const role of input.roles) {
    if (!roleHasPermission(role.roleId, permission)) continue;
    if (!scopeAllows(role, input)) continue;

    grants.push({
      permission,
      roleId: role.roleId,
      scope: role.scope,
      organizationId: role.organizationId,
      projectId: role.projectId,
    });
  }

  return grants;
}

function scopeAllows(role: RoleAssignment, input: PermissionScopeInput) {
  switch (role.scope) {
    case "global":
      return true;
    case "organization_tree":
      return allowsOrganizationTree(role, input);
    case "project":
      return role.projectId !== undefined && role.projectId !== null && role.projectId === input.target.projectId;
    case "own_related":
      return isOwnRelated(input.userId, input.target);
  }
}

function allowsOrganizationTree(role: RoleAssignment, input: PermissionScopeInput) {
  if (!input.target.organizationId || !role.organizationId) return false;
  if (role.organizationId === input.target.organizationId) return true;

  return input.organizationTreeIdsByOrganizationId?.[role.organizationId]?.includes(input.target.organizationId) === true;
}

function isOwnRelated(userId: string, target: PermissionTarget) {
  return (
    target.requesterId === userId ||
    target.responsibleUserId === userId ||
    target.assigneeIds?.includes(userId) === true ||
    target.watcherIds?.includes(userId) === true ||
    target.commentAuthorIds?.includes(userId) === true
  );
}
