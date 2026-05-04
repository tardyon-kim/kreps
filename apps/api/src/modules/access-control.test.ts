import { describe, expect, it } from "vitest";
import type { AuthUser } from "../auth/session.js";
import { rbacFixtures } from "../test/rbac-fixtures.js";
import {
  buildOrganizationTreeIdsByOrganizationId,
  listAccessibleOrganizationIds,
  type AccessStore,
} from "./access-control.js";

describe("buildOrganizationTreeIdsByOrganizationId", () => {
  it("collects recursive descendants for organization-tree permissions", () => {
    expect(
      buildOrganizationTreeIdsByOrganizationId([
        { id: "root", parentId: null },
        { id: "product", parentId: "root" },
        { id: "platform", parentId: "product" },
        { id: "sales", parentId: "root" },
      ]),
    ).toEqual({
      root: ["product", "platform", "sales"],
      product: ["platform"],
      platform: [],
      sales: [],
    });
  });

  it("merges organization visibility across multiple permission grants", async () => {
    const store: AccessStore = {
      async listRoleAssignments() {
        return [];
      },
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
      },
    };
    const actor: AuthUser = {
      id: rbacFixtures.managerUserId,
      organizationId: rbacFixtures.childOrganizationId,
      email: "manager@example.local",
      displayName: "Organization Admin",
      passwordHash: "hash",
      locale: "ko",
      theme: "system",
      status: "active",
    };

    await expect(
      listAccessibleOrganizationIds(store, actor, [
        {
          permission: "users.manage",
          roleId: "organization_admin",
          scope: "organization_tree",
          organizationId: rbacFixtures.childOrganizationId,
        },
        {
          permission: "users.manage",
          roleId: "organization_admin",
          scope: "organization_tree",
          organizationId: rbacFixtures.siblingOrganizationId,
        },
      ]),
    ).resolves.toEqual([
      rbacFixtures.childOrganizationId,
      rbacFixtures.grandchildOrganizationId,
      rbacFixtures.siblingOrganizationId,
    ]);
  });
});
