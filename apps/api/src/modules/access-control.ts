import { type Permission, roleHasPermission } from "@kreps/shared";
import { eq } from "drizzle-orm";
import type { AuthUser } from "../auth/session.js";
import type { PermissionGrant, PermissionTarget, RoleAssignment } from "../auth/rbac.js";
import { PermissionDeniedError, requirePermission } from "../auth/rbac.js";
import type { DatabaseClient } from "../db/client.js";
import { organizations, userRoles } from "../db/schema.js";

export type AccessStore = {
  listRoleAssignments(userId: string): Promise<RoleAssignment[]>;
  listOrganizationTreeIdsByOrganizationId(): Promise<Record<string, readonly string[]>>;
};

export async function assertActorPermission(
  store: AccessStore,
  actor: AuthUser,
  permission: Permission,
  target: PermissionTarget,
) {
  const [roles, organizationTreeIdsByOrganizationId] = await Promise.all([
    store.listRoleAssignments(actor.id),
    store.listOrganizationTreeIdsByOrganizationId(),
  ]);

  return requirePermission(permission, {
    userId: actor.id,
    roles,
    target,
    organizationTreeIdsByOrganizationId,
  });
}

export async function listAccessibleOrganizationIds(
  store: AccessStore,
  actor: AuthUser,
  grantOrGrants: PermissionGrant | readonly PermissionGrant[],
): Promise<readonly string[] | null> {
  const grants = Array.isArray(grantOrGrants) ? grantOrGrants : [grantOrGrants];
  if (grants.some((grant) => grant.scope === "global")) return null;

  const organizationTreeIdsByOrganizationId = await store.listOrganizationTreeIdsByOrganizationId();
  const organizationIds = new Set<string>();

  for (const grant of grants) {
    if (grant.scope === "organization_tree" && grant.organizationId) {
      organizationIds.add(grant.organizationId);
      for (const descendantId of organizationTreeIdsByOrganizationId[grant.organizationId] ?? []) {
        organizationIds.add(descendantId);
      }
    } else if (grant.scope === "own_related") {
      organizationIds.add(actor.organizationId);
    }
  }

  return [...organizationIds];
}

export async function listActorPermissionGrants(
  store: AccessStore,
  actor: AuthUser,
  permission: Permission,
): Promise<readonly PermissionGrant[]> {
  const roles = await store.listRoleAssignments(actor.id);
  const grants = roles.flatMap((role) => {
    if (!roleHasPermission(role.roleId, permission)) return [];

    return {
      permission,
      roleId: role.roleId,
      scope: role.scope,
      organizationId: role.organizationId,
      projectId: role.projectId,
    } satisfies PermissionGrant;
  });

  if (grants.length === 0) throw new PermissionDeniedError(permission);
  return grants;
}

export class PostgresAccessStore implements AccessStore {
  constructor(protected readonly db: DatabaseClient["db"]) {}

  async listRoleAssignments(userId: string) {
    const rows = await this.db
      .select({
        roleId: userRoles.roleId,
        scope: userRoles.scope,
        organizationId: userRoles.organizationId,
        projectId: userRoles.projectId,
      })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    return rows;
  }

  async listOrganizationTreeIdsByOrganizationId() {
    const rows = await this.db
      .select({
        id: organizations.id,
        parentId: organizations.parentId,
      })
      .from(organizations);

    return buildOrganizationTreeIdsByOrganizationId(rows);
  }
}

export function buildOrganizationTreeIdsByOrganizationId(
  rows: readonly { id: string; parentId: string | null }[],
): Record<string, readonly string[]> {
  const childIdsByParentId = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const childIds = childIdsByParentId.get(row.parentId) ?? [];
    childIds.push(row.id);
    childIdsByParentId.set(row.parentId, childIds);
  }

  const treeIdsByOrganizationId: Record<string, string[]> = {};
  const collectDescendants = (organizationId: string): string[] => {
    const childIds = childIdsByParentId.get(organizationId) ?? [];
    return childIds.flatMap((childId) => [childId, ...collectDescendants(childId)]);
  };

  for (const row of rows) {
    treeIdsByOrganizationId[row.id] = collectDescendants(row.id);
  }

  return treeIdsByOrganizationId;
}
