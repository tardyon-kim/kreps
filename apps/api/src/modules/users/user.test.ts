import { describe, expect, it } from "vitest";
import type { RoleAssignment } from "../../auth/rbac.js";
import { buildApp } from "../../app.js";
import type { AuditLogInput } from "../../audit/audit-log.js";
import { loadConfig } from "../../config.js";
import {
  MemoryAuthStore,
  apiRouteTestEnv,
  createRouteTestUsers,
  loginAndGetCookie,
} from "../../test/auth-route-helpers.js";
import { rbacFixtures } from "../../test/rbac-fixtures.js";
import {
  UserNotFoundError,
  UserService,
  type DirectoryUser,
  type UserPreferences,
  type UserStore,
} from "./user.service.js";

class MemoryUserStore implements UserStore {
  readonly audits: AuditLogInput[] = [];
  readonly rolesByUser: Record<string, RoleAssignment[]> = {
    [rbacFixtures.adminUserId]: [{ roleId: "system_admin", scope: "global" }],
    [rbacFixtures.managerUserId]: [
      { roleId: "organization_admin", scope: "organization_tree", organizationId: rbacFixtures.childOrganizationId },
    ],
    [rbacFixtures.employeeUserId]: [
      { roleId: "employee", scope: "own_related", organizationId: rbacFixtures.childOrganizationId },
      { roleId: "viewer", scope: "global" },
      { roleId: "project_manager", scope: "project", projectId: rbacFixtures.projectId },
      { roleId: "work_manager", scope: "organization_tree", organizationId: rbacFixtures.siblingOrganizationId },
      { roleId: "project_manager", scope: "project", projectId: rbacFixtures.siblingProjectId },
    ],
    [rbacFixtures.grandchildUserId]: [
      { roleId: "employee", scope: "own_related", organizationId: rbacFixtures.grandchildOrganizationId },
    ],
    [rbacFixtures.unrelatedUserId]: [
      { roleId: "employee", scope: "own_related", organizationId: rbacFixtures.siblingOrganizationId },
    ],
  };

  private readonly preferences = new Map<string, UserPreferences>([
    [rbacFixtures.adminUserId, { locale: "ko", theme: "system" }],
    [rbacFixtures.employeeUserId, { locale: "en", theme: "system" }],
  ]);
  private readonly projectOrganizationIds = new Map<string, string>([
    [rbacFixtures.projectId, rbacFixtures.childOrganizationId],
    [rbacFixtures.siblingProjectId, rbacFixtures.siblingOrganizationId],
  ]);

  async listUsers(organizationIds?: readonly string[] | null): Promise<DirectoryUser[]> {
    const users: DirectoryUser[] = [
      {
        id: rbacFixtures.adminUserId,
        organizationId: rbacFixtures.rootOrganizationId,
        organization: {
          id: rbacFixtures.rootOrganizationId,
          name: "Headquarters",
          code: "HQ",
        },
        email: "admin@example.local",
        displayName: "System Admin",
        locale: "ko",
        theme: "system",
        status: "active",
        roles: [{ roleId: "system_admin", scope: "global" }],
      },
      {
        id: rbacFixtures.managerUserId,
        organizationId: rbacFixtures.childOrganizationId,
        organization: {
          id: rbacFixtures.childOrganizationId,
          name: "Product Team",
          code: "PRODUCT",
        },
        email: "manager@example.local",
        displayName: "Organization Admin",
        locale: "ko",
        theme: "system",
        status: "active",
        roles: [
          { roleId: "organization_admin", scope: "organization_tree", organizationId: rbacFixtures.childOrganizationId },
          { roleId: "work_manager", scope: "organization_tree", organizationId: rbacFixtures.childOrganizationId },
        ],
      },
      {
        id: rbacFixtures.employeeUserId,
        organizationId: rbacFixtures.childOrganizationId,
        organization: {
          id: rbacFixtures.childOrganizationId,
          name: "Product Team",
          code: "PRODUCT",
        },
        email: "employee@example.local",
        displayName: "Employee",
        locale: this.preferences.get(rbacFixtures.employeeUserId)?.locale ?? "en",
        theme: this.preferences.get(rbacFixtures.employeeUserId)?.theme ?? "system",
        status: "active",
        roles: this.rolesByUser[rbacFixtures.employeeUserId] ?? [],
      },
      {
        id: rbacFixtures.grandchildUserId,
        organizationId: rbacFixtures.grandchildOrganizationId,
        organization: {
          id: rbacFixtures.grandchildOrganizationId,
          name: "Platform Team",
          code: "PLATFORM",
        },
        email: "platform@example.local",
        displayName: "Platform Employee",
        locale: "en",
        theme: "system",
        status: "active",
        roles: this.rolesByUser[rbacFixtures.grandchildUserId] ?? [],
      },
      {
        id: rbacFixtures.unrelatedUserId,
        organizationId: rbacFixtures.siblingOrganizationId,
        organization: {
          id: rbacFixtures.siblingOrganizationId,
          name: "Sales Team",
          code: "SALES",
        },
        email: "sales@example.local",
        displayName: "Sales Employee",
        locale: "en",
        theme: "system",
        status: "active",
        roles: this.rolesByUser[rbacFixtures.unrelatedUserId] ?? [],
      },
    ];

    if (!organizationIds) return users;
    const visibleOrganizationIds = new Set(organizationIds);
    return users
      .filter((user) => visibleOrganizationIds.has(user.organizationId))
      .map((user) => ({
        ...user,
        roles: user.roles.filter((role) =>
          isMemoryDirectoryRoleVisible(role, visibleOrganizationIds, this.projectOrganizationIds),
        ),
      }));
  }

  async getUserPreferences(userId: string) {
    return this.preferences.get(userId) ?? null;
  }

  async updateUserPreferencesWithAudit(userId: string, preferences: Partial<UserPreferences>, actorUserId: string) {
    const before = this.preferences.get(userId);
    if (!before) {
      throw new UserNotFoundError(userId);
    }

    const after = {
      locale: preferences.locale ?? before.locale,
      theme: preferences.theme ?? before.theme,
    };
    this.preferences.set(userId, after);
    this.audits.push({
      actorUserId,
      action: "user.preferences_updated",
      targetType: "user",
      targetId: userId,
      before,
      after,
    });
    return after;
  }

  async listRoleAssignments(userId: string) {
    return this.rolesByUser[userId] ?? [];
  }

  async listOrganizationTreeIdsByOrganizationId() {
    return {
      [rbacFixtures.rootOrganizationId]: [
        rbacFixtures.childOrganizationId,
        rbacFixtures.grandchildOrganizationId,
        rbacFixtures.siblingOrganizationId,
      ],
      [rbacFixtures.childOrganizationId]: [rbacFixtures.grandchildOrganizationId],
      [rbacFixtures.grandchildOrganizationId]: [],
      [rbacFixtures.siblingOrganizationId]: [],
    };
  }
}

async function buildUserTestApp(store = new MemoryUserStore()) {
  const config = loadConfig(apiRouteTestEnv());
  const authStore = new MemoryAuthStore(await createRouteTestUsers());
  const app = buildApp(config, {
    authStore,
    userService: new UserService(store),
  });

  return { app, store };
}

describe("user routes", () => {
  it("requires authentication to list users", async () => {
    const { app } = await buildUserTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "not_authenticated" });
    } finally {
      await app.close();
    }
  });

  it("requires users.manage to list users", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "permission_denied" });
    } finally {
      await app.close();
    }
  });

  it("returns all users with organization and role assignments for system admins", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "admin@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        users: [
          {
            email: "admin@example.local",
            organization: { code: "HQ" },
            roles: [{ roleId: "system_admin", scope: "global" }],
          },
          {
            email: "manager@example.local",
            organization: { code: "PRODUCT" },
            roles: [
              { roleId: "organization_admin", scope: "organization_tree" },
              { roleId: "work_manager", scope: "organization_tree" },
            ],
          },
          {
            email: "employee@example.local",
            organization: { code: "PRODUCT" },
            roles: [
              { roleId: "employee", scope: "own_related" },
              { roleId: "viewer", scope: "global" },
              { roleId: "project_manager", scope: "project", projectId: rbacFixtures.projectId },
              { roleId: "work_manager", scope: "organization_tree" },
              { roleId: "project_manager", scope: "project", projectId: rbacFixtures.siblingProjectId },
            ],
          },
          {
            email: "platform@example.local",
            organization: { code: "PLATFORM" },
          },
          {
            email: "sales@example.local",
            organization: { code: "SALES" },
          },
        ],
      });
      expect(response.json().users[0].passwordHash).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("returns only scoped users for organization admins", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "manager@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().users.map((user: DirectoryUser) => user.email)).toEqual([
        "manager@example.local",
        "employee@example.local",
        "platform@example.local",
      ]);
      const employee = response.json().users.find((user: DirectoryUser) => user.email === "employee@example.local");
      expect(employee.roles).toEqual([
        { roleId: "employee", scope: "own_related", organizationId: rbacFixtures.childOrganizationId },
        { roleId: "project_manager", scope: "project", projectId: rbacFixtures.projectId },
      ]);
    } finally {
      await app.close();
    }
  });

  it("merges multiple grants when calculating directory visibility", async () => {
    const store = new MemoryUserStore();
    store.rolesByUser[rbacFixtures.managerUserId] = [
      { roleId: "organization_admin", scope: "organization_tree", organizationId: rbacFixtures.childOrganizationId },
      { roleId: "system_admin", scope: "global" },
    ];
    const { app } = await buildUserTestApp(store);

    try {
      const cookie = await loginAndGetCookie(app, "manager@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/users",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().users.map((user: DirectoryUser) => user.email)).toEqual([
        "admin@example.local",
        "manager@example.local",
        "employee@example.local",
        "platform@example.local",
        "sales@example.local",
      ]);
    } finally {
      await app.close();
    }
  });

  it("requires authentication to update preferences", async () => {
    const { app } = await buildUserTestApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.employeeUserId}/preferences`,
        payload: {
          locale: "ko",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "not_authenticated" });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid preference params", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: "/api/users/not-a-uuid/preferences",
        headers: { cookie },
        payload: {
          locale: "ko",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "invalid_request" });
    } finally {
      await app.close();
    }
  });

  it("rejects invalid preference bodies", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.employeeUserId}/preferences`,
        headers: { cookie },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "invalid_request" });
    } finally {
      await app.close();
    }
  });

  it("allows a logged-in user to update locale and theme preferences", async () => {
    const { app, store } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.employeeUserId}/preferences`,
        headers: { cookie },
        payload: {
          locale: "ko",
          theme: "dark",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: rbacFixtures.employeeUserId,
          locale: "ko",
          theme: "dark",
        },
      });
      expect(store.audits).toHaveLength(1);
      expect(store.audits[0]).toMatchObject({
        actorUserId: rbacFixtures.employeeUserId,
        action: "user.preferences_updated",
        targetType: "user",
        targetId: rbacFixtures.employeeUserId,
        before: { locale: "en", theme: "system" },
        after: { locale: "ko", theme: "dark" },
      });
    } finally {
      await app.close();
    }
  });

  it("preserves the existing theme when only locale changes", async () => {
    const { app, store } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.employeeUserId}/preferences`,
        headers: { cookie },
        payload: {
          locale: "ko",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: rbacFixtures.employeeUserId,
          locale: "ko",
          theme: "system",
        },
      });
      expect(store.audits[0]).toMatchObject({
        before: { locale: "en", theme: "system" },
        after: { locale: "ko", theme: "system" },
      });
    } finally {
      await app.close();
    }
  });

  it("preserves the existing locale when only theme changes", async () => {
    const { app, store } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.employeeUserId}/preferences`,
        headers: { cookie },
        payload: {
          theme: "dark",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        user: {
          id: rbacFixtures.employeeUserId,
          locale: "en",
          theme: "dark",
        },
      });
      expect(store.audits[0]).toMatchObject({
        before: { locale: "en", theme: "system" },
        after: { locale: "en", theme: "dark" },
      });
    } finally {
      await app.close();
    }
  });

  it("maps missing users to not found when updating own preferences", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "manager@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.managerUserId}/preferences`,
        headers: { cookie },
        payload: {
          locale: "en",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "user_not_found" });
    } finally {
      await app.close();
    }
  });

  it("does not allow a user to update another user's preferences", async () => {
    const { app } = await buildUserTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "PATCH",
        url: `/api/users/${rbacFixtures.adminUserId}/preferences`,
        headers: { cookie },
        payload: {
          locale: "ko",
          theme: "dark",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "permission_denied" });
    } finally {
      await app.close();
    }
  });
});

function isMemoryDirectoryRoleVisible(
  role: RoleAssignment,
  visibleOrganizationIds: ReadonlySet<string>,
  projectOrganizationIds: ReadonlyMap<string, string>,
) {
  switch (role.scope) {
    case "global":
      return false;
    case "organization_tree":
    case "own_related":
      return role.organizationId !== undefined && role.organizationId !== null && visibleOrganizationIds.has(role.organizationId);
    case "project": {
      if (!role.projectId) return false;
      const projectOrganizationId = projectOrganizationIds.get(role.projectId);
      return projectOrganizationId !== undefined && visibleOrganizationIds.has(projectOrganizationId);
    }
  }
}
