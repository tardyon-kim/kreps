import { describe, expect, it } from "vitest";
import {
  defaultRolePermissions,
  isPermission,
  isRole,
  isValidScope,
  permissions,
  roleHasPermission,
  roles,
} from "./permissions";

describe("default role permissions", () => {
  it("grants audit view to system admins", () => {
    expect(roleHasPermission("system_admin", "audit.view")).toBe(true);
  });

  it("allows employees to create work", () => {
    expect(roleHasPermission("employee", "work.create")).toBe(true);
  });

  it("does not allow viewers to change work status", () => {
    expect(roleHasPermission("viewer", "work.changeStatus")).toBe(false);
  });

  it("recognizes organization tree as a valid scope", () => {
    expect(isValidScope("organization_tree")).toBe(true);
  });

  it("exports a complete default role-permission mapping for RBAC seed data", () => {
    expect(Object.keys(defaultRolePermissions)).toEqual([...roles]);
    expect(defaultRolePermissions.system_admin).toEqual([...permissions]);
  });

  it("validates role and permission strings from API input", () => {
    expect(isRole("work_manager")).toBe(true);
    expect(isRole("manager")).toBe(false);
    expect(isPermission("work.assign")).toBe(true);
    expect(isPermission("work.delete")).toBe(false);
  });
});
