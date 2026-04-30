import { describe, expect, it } from "vitest";
import { rbacFixtures } from "../test/rbac-fixtures.js";
import { PermissionDeniedError, requirePermission } from "./rbac.js";

const childWorkItem = {
  organizationId: rbacFixtures.childOrganizationId,
  projectId: rbacFixtures.projectId,
  requesterId: rbacFixtures.adminUserId,
  responsibleUserId: rbacFixtures.managerUserId,
  assigneeIds: [rbacFixtures.employeeUserId],
  watcherIds: [],
  commentAuthorIds: [],
};

describe("requirePermission", () => {
  it("allows a work manager to change work status inside their organization tree", () => {
    expect(
      requirePermission("work.changeStatus", {
        userId: rbacFixtures.managerUserId,
        roles: [
          {
            roleId: "work_manager",
            scope: "organization_tree",
            organizationId: rbacFixtures.childOrganizationId,
          },
        ],
        organizationTreeIdsByOrganizationId: {
          [rbacFixtures.childOrganizationId]: [rbacFixtures.childOrganizationId],
        },
        target: childWorkItem,
      }),
    ).toMatchObject({
      permission: "work.changeStatus",
      scope: "organization_tree",
      roleId: "work_manager",
    });
  });

  it("rejects organization-tree access when the tree is not bound to the role organization", () => {
    expect(() =>
      requirePermission("work.changeStatus", {
        userId: rbacFixtures.managerUserId,
        roles: [
          {
            roleId: "work_manager",
            scope: "organization_tree",
            organizationId: rbacFixtures.rootOrganizationId,
          },
        ],
        organizationTreeIdsByOrganizationId: {
          [rbacFixtures.childOrganizationId]: [rbacFixtures.childOrganizationId],
        },
        target: childWorkItem,
      }),
    ).toThrow(PermissionDeniedError);
  });

  it("rejects an employee changing work status even when they are related to the item", () => {
    expect(() =>
      requirePermission("work.changeStatus", {
        userId: rbacFixtures.employeeUserId,
        roles: [
          {
            roleId: "employee",
            scope: "own_related",
            organizationId: rbacFixtures.childOrganizationId,
          },
        ],
        target: childWorkItem,
      }),
    ).toThrow(PermissionDeniedError);
  });

  it("allows own-related permissions when the user is assigned to the work item", () => {
    expect(
      requirePermission("comments.create", {
        userId: rbacFixtures.employeeUserId,
        roles: [
          {
            roleId: "employee",
            scope: "own_related",
            organizationId: rbacFixtures.childOrganizationId,
          },
        ],
        target: childWorkItem,
      }),
    ).toMatchObject({
      permission: "comments.create",
      scope: "own_related",
      roleId: "employee",
    });
  });
});
