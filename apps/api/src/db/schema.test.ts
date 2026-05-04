import { describe, expect, it } from "vitest";
import { auditEvents, glossaryTerms, organizations, projects, users, workItemHistory, workItems } from "./schema.js";

describe("database schema", () => {
  it("defines core Work OS tables", () => {
    expect(users).toBeDefined();
    expect(organizations).toBeDefined();
    expect(workItems).toBeDefined();
    expect(workItemHistory).toBeDefined();
    expect(auditEvents).toBeDefined();
    expect(projects).toBeDefined();
    expect(glossaryTerms).toBeDefined();
  });
});
