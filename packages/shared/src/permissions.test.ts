import { describe, expect, it } from "vitest";
import { isValidScope, roleHasPermission } from "./permissions";

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
});
