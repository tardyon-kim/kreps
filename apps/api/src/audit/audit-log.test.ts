import { describe, expect, it } from "vitest";
import { createWorkItemStatusAudit } from "./audit-log.js";

describe("createWorkItemStatusAudit", () => {
  it("includes before and after status values for a work item status update", () => {
    const createdAt = new Date("2026-04-30T00:00:00.000Z");

    const payload = createWorkItemStatusAudit({
      actorUserId: "00000000-0000-4000-8000-000000000101",
      workItemId: "00000000-0000-4000-8000-000000000301",
      beforeStatus: "registered",
      afterStatus: "in_progress",
      createdAt,
    });

    expect(payload).toEqual({
      actorUserId: "00000000-0000-4000-8000-000000000101",
      action: "work_item.status_changed",
      targetType: "work_item",
      targetId: "00000000-0000-4000-8000-000000000301",
      before: { status: "registered" },
      after: { status: "in_progress" },
      createdAt,
    });
  });
});
