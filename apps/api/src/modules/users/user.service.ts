import type { Locale, Scope, ThemePreference } from "@kreps/shared";
import { asc, eq, inArray } from "drizzle-orm";
import type { RoleAssignment } from "../../auth/rbac.js";
import { PermissionDeniedError } from "../../auth/rbac.js";
import type { AuthUser } from "../../auth/session.js";
import { auditLogInsertValues, createAuditLogEntry } from "../../audit/audit-log.js";
import type { DatabaseClient } from "../../db/client.js";
import { auditEvents, organizations, projects, userRoles, users } from "../../db/schema.js";
import {
  listActorPermissionGrants,
  listAccessibleOrganizationIds,
  type AccessStore,
  PostgresAccessStore,
} from "../access-control.js";

export type UserPreferences = {
  locale: Locale;
  theme: ThemePreference;
};

export type DirectoryUser = {
  id: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    code: string;
  };
  email: string;
  displayName: string;
  locale: Locale;
  theme: ThemePreference;
  status: "active" | "disabled";
  roles: RoleAssignment[];
};

export type UserStore = AccessStore &
  {
    listUsers(organizationIds?: readonly string[] | null): Promise<DirectoryUser[]>;
    updateUserPreferencesWithAudit(
      userId: string,
      preferences: Partial<UserPreferences>,
      actorUserId: string,
    ): Promise<UserPreferences>;
  };

export class UserService {
  constructor(private readonly store: UserStore) {}

  async listUsers(actor: AuthUser) {
    const grants = await listActorPermissionGrants(this.store, actor, "users.manage");
    const organizationIds = await listAccessibleOrganizationIds(this.store, actor, grants);
    return this.store.listUsers(organizationIds);
  }

  async updatePreferences(actor: AuthUser, userId: string, input: Partial<UserPreferences>) {
    if (actor.id !== userId) {
      throw new PermissionDeniedError("users.manage");
    }

    const preferences = await this.store.updateUserPreferencesWithAudit(userId, input, actor.id);

    return {
      id: userId,
      ...preferences,
    };
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class PostgresUserStore extends PostgresAccessStore implements UserStore {
  constructor(db: DatabaseClient["db"]) {
    super(db);
  }

  async listUsers(organizationIds?: readonly string[] | null) {
    if (organizationIds && organizationIds.length === 0) return [];

    const query = this.db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        organizationName: organizations.name,
        organizationCode: organizations.code,
        email: users.email,
        displayName: users.displayName,
        locale: users.locale,
        theme: users.theme,
        status: users.status,
        roleId: userRoles.roleId,
        scope: userRoles.scope,
        roleOrganizationId: userRoles.organizationId,
        projectId: userRoles.projectId,
        projectOrganizationId: projects.organizationId,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .leftJoin(projects, eq(userRoles.projectId, projects.id));
    const rows = organizationIds
      ? await query
          .where(inArray(users.organizationId, [...organizationIds]))
          .orderBy(asc(users.email), asc(userRoles.roleId))
      : await query.orderBy(asc(users.email), asc(userRoles.roleId));

    const roleOrganizationFilter = organizationIds ? new Set(organizationIds) : null;
    const usersById = new Map<string, DirectoryUser>();
    for (const row of rows) {
      const existing =
        usersById.get(row.id) ??
        ({
          id: row.id,
          organizationId: row.organizationId,
          organization: {
            id: row.organizationId,
            name: row.organizationName,
            code: row.organizationCode,
          },
          email: row.email,
          displayName: row.displayName,
          locale: row.locale,
          theme: row.theme,
          status: row.status,
          roles: [],
        } satisfies DirectoryUser);

      if (
        row.roleId &&
        row.scope &&
        isDirectoryRoleVisible(row.scope, row.roleOrganizationId, row.projectOrganizationId, roleOrganizationFilter)
      ) {
        existing.roles.push({
          roleId: row.roleId,
          scope: row.scope,
          organizationId: row.roleOrganizationId,
          projectId: row.projectId,
        });
      }

      usersById.set(row.id, existing);
    }

    return [...usersById.values()];
  }

  async updateUserPreferencesWithAudit(userId: string, preferences: Partial<UserPreferences>, actorUserId: string) {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select({
          locale: users.locale,
          theme: users.theme,
        })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1);

      if (!before) {
        throw new UserNotFoundError(userId);
      }

      const after = {
        locale: preferences.locale ?? before.locale,
        theme: preferences.theme ?? before.theme,
      };
      const [user] = await tx
        .update(users)
        .set({
          locale: after.locale,
          theme: after.theme,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          locale: users.locale,
          theme: users.theme,
        });

      if (!user) {
        throw new UserNotFoundError(userId);
      }

      await tx.insert(auditEvents).values(
        auditLogInsertValues({
          ...createAuditLogEntry({
            actorUserId,
            action: "user.preferences_updated",
            targetType: "user",
            targetId: userId,
            before,
            after: user,
          }),
          after: user,
        }),
      );

      return user;
    });
  }
}

export function isPermissionDenied(error: unknown) {
  return error instanceof PermissionDeniedError;
}

function isDirectoryRoleVisible(
  scope: Scope,
  organizationId: string | null,
  projectOrganizationId: string | null,
  visibleOrganizationIds: ReadonlySet<string> | null,
) {
  if (!visibleOrganizationIds) return true;

  switch (scope) {
    case "global":
      return false;
    case "organization_tree":
    case "own_related":
      return organizationId !== null && visibleOrganizationIds.has(organizationId);
    case "project":
      return projectOrganizationId !== null && visibleOrganizationIds.has(projectOrganizationId);
  }
}
