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
import { buildOrganizationTreeIdsByOrganizationId } from "../access-control.js";
import { OrganizationService, type OrganizationRecord, type OrganizationStore } from "./organization.service.js";

class MemoryOrganizationStore implements OrganizationStore {
  readonly audits: AuditLogInput[] = [];
  readonly organizations: OrganizationRecord[] = [
    {
      id: rbacFixtures.rootOrganizationId,
      parentId: null,
      name: "Headquarters",
      code: "HQ",
      defaultLocale: "ko",
    },
    {
      id: rbacFixtures.childOrganizationId,
      parentId: rbacFixtures.rootOrganizationId,
      name: "Product Team",
      code: "PRODUCT",
      defaultLocale: "ko",
    },
    {
      id: rbacFixtures.grandchildOrganizationId,
      parentId: rbacFixtures.childOrganizationId,
      name: "Platform Team",
      code: "PLATFORM",
      defaultLocale: "ko",
    },
    {
      id: rbacFixtures.siblingOrganizationId,
      parentId: rbacFixtures.rootOrganizationId,
      name: "Sales Team",
      code: "SALES",
      defaultLocale: "en",
    },
  ];

  private nextId = "00000000-0000-4000-8000-000000000901";

  async listOrganizations(organizationIds?: readonly string[] | null) {
    if (!organizationIds) return this.organizations;
    return this.organizations.filter((organization) => organizationIds.includes(organization.id));
  }

  async findOrganizationByCode(code: string) {
    return this.organizations.find((organization) => organization.code === code) ?? null;
  }

  async organizationExists(id: string) {
    return this.organizations.some((organization) => organization.id === id);
  }

  async createOrganizationWithAudit(input: Omit<OrganizationRecord, "id">, audit: AuditLogInput) {
    const organization = {
      id: this.nextId,
      ...input,
    };
    this.organizations.push(organization);
    this.audits.push({
      ...audit,
      targetId: organization.id,
      after: {
        name: organization.name,
        code: organization.code,
        parentId: organization.parentId,
        defaultLocale: organization.defaultLocale,
      },
    });
    return organization;
  }

  async listRoleAssignments(userId: string) {
    const rolesByUser: Record<string, RoleAssignment[]> = {
      [rbacFixtures.adminUserId]: [{ roleId: "system_admin", scope: "global" }],
      [rbacFixtures.managerUserId]: [
        { roleId: "organization_admin", scope: "organization_tree", organizationId: rbacFixtures.childOrganizationId },
      ],
      [rbacFixtures.employeeUserId]: [
        { roleId: "employee", scope: "own_related", organizationId: rbacFixtures.childOrganizationId },
      ],
    };

    return rolesByUser[userId] ?? [];
  }

  async listOrganizationTreeIdsByOrganizationId() {
    return buildOrganizationTreeIdsByOrganizationId(this.organizations);
  }
}

async function buildOrganizationTestApp(store = new MemoryOrganizationStore()) {
  const config = loadConfig(apiRouteTestEnv());
  const authStore = new MemoryAuthStore(await createRouteTestUsers());
  const app = buildApp(config, {
    authStore,
    organizationService: new OrganizationService(store),
  });

  return { app, config, store };
}

describe("organization routes", () => {
  it("requires authentication for the organization tree", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/tree",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "not_authenticated" });
    } finally {
      await app.close();
    }
  });

  it("requires authentication to create organizations", async () => {
    const { app, store } = await buildOrganizationTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        payload: {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Operations",
          code: "OPS",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "not_authenticated" });
      expect(store.organizations.some((organization) => organization.code === "OPS")).toBe(false);
      expect(store.audits).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("requires organizations.manage to read the organization tree", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/tree",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "permission_denied" });
    } finally {
      await app.close();
    }
  });

  it("returns the scoped organization tree for organization admins", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "manager@example.local");
      const response = await app.inject({
        method: "GET",
        url: "/api/organizations/tree",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        organizations: [
          {
            id: rbacFixtures.childOrganizationId,
            parentId: null,
            name: "Product Team",
            code: "PRODUCT",
            children: [
              {
                id: rbacFixtures.grandchildOrganizationId,
                parentId: rbacFixtures.childOrganizationId,
                name: "Platform Team",
                code: "PLATFORM",
              },
            ],
          },
        ],
      });
      const body = response.json() as { organizations: OrganizationRecord[] };
      expect(JSON.stringify(body.organizations)).not.toContain(rbacFixtures.rootOrganizationId);
      expect(JSON.stringify(body.organizations)).not.toContain(rbacFixtures.siblingOrganizationId);
    } finally {
      await app.close();
    }
  });

  it("rejects invalid organization create payloads", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "admin@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          name: "",
          code: "bad lowercase",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "invalid_request" });
    } finally {
      await app.close();
    }
  });

  it("requires organizations.manage to create an organization", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "employee@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Operations",
          code: "OPS",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "permission_denied" });
    } finally {
      await app.close();
    }
  });

  it("does not let scoped organization admins create root organizations", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "manager@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          name: "Operations",
          code: "OPS",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "permission_denied" });
    } finally {
      await app.close();
    }
  });

  it("maps duplicate organization codes to conflict", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "admin@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Duplicate Product",
          code: "PRODUCT",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "organization_code_conflict" });
    } finally {
      await app.close();
    }
  });

  it("maps missing parent organizations to not found", async () => {
    const { app } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "admin@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          parentId: "00000000-0000-4000-8000-000000000999",
          name: "Missing Parent",
          code: "MISSING",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "organization_parent_not_found" });
    } finally {
      await app.close();
    }
  });

  it("creates organizations for authorized users and records audit", async () => {
    const { app, store } = await buildOrganizationTestApp();

    try {
      const cookie = await loginAndGetCookie(app, "admin@example.local");
      const response = await app.inject({
        method: "POST",
        url: "/api/organizations",
        headers: { cookie },
        payload: {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Operations",
          code: "OPS",
          defaultLocale: "ko",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        organization: {
          parentId: rbacFixtures.rootOrganizationId,
          name: "Operations",
          code: "OPS",
          defaultLocale: "ko",
        },
      });
      expect(store.audits).toHaveLength(1);
      expect(store.audits[0]).toMatchObject({
        actorUserId: rbacFixtures.adminUserId,
        action: "organization.created",
        targetType: "organization",
        after: {
          name: "Operations",
          code: "OPS",
        },
      });
    } finally {
      await app.close();
    }
  });
});
