import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { rbacFixtures } from "../test/rbac-fixtures.js";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashes passwords without storing the plain text", async () => {
    const hash = await hashPassword("ChangeMe123!");

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("ChangeMe123!");
  });

  it("uses a per-password random salt", async () => {
    const first = await hashPassword("ChangeMe123!");
    const second = await hashPassword("ChangeMe123!");

    expect(first).not.toEqual(second);
  });

  it("accepts the right password and rejects a wrong password", async () => {
    const hash = await hashPassword("ChangeMe123!");

    await expect(verifyPassword("ChangeMe123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123!", hash)).resolves.toBe(false);
  });

  it("verifies legacy deterministic seed hashes", async () => {
    const salt = `kreps-seed:${rbacFixtures.adminUserId}`;
    const hash = `scrypt$${salt}$${scryptSync("ChangeMe123!", salt, 64).toString("hex")}`;

    await expect(verifyPassword("ChangeMe123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123!", hash)).resolves.toBe(false);
  });

  it("rejects malformed v1 hash parameters instead of throwing", async () => {
    await expect(
      verifyPassword(
        "ChangeMe123!",
        "scrypt$v1$not-a-number$8$1$64$some-salt$some-hash",
      ),
    ).resolves.toBe(false);
  });
});
