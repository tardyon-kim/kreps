import { describe, expect, it } from "vitest";
import { migrationStatements } from "./migrate.js";

describe("manual database migrations", () => {
  it("keeps the user_roles primary key and scoped uniqueness retrofit atomic", () => {
    const standaloneUserRoleAlterStatements = migrationStatements.filter((statement) =>
      statement.trim().startsWith("ALTER TABLE user_roles"),
    );
    const retrofitStatement = migrationStatements.find((statement) =>
      statement.includes("LOCK TABLE user_roles IN ACCESS EXCLUSIVE MODE"),
    );

    expect(standaloneUserRoleAlterStatements).toEqual([]);
    expect(retrofitStatement).toBeDefined();
    expect(retrofitStatement).toContain("DROP CONSTRAINT user_roles_pkey");
    expect(retrofitStatement).toContain("ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id)");
    expect(retrofitStatement).toContain("ADD CONSTRAINT user_roles_unique_scope_target");
  });
});
