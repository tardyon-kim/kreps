import { describe, expect, it } from "vitest";
import { canTransitionWorkStatus, getWorkStatusGroup } from "./workflow";

describe("work item workflow", () => {
  it("allows a simple work item to move from registered to assigned", () => {
    expect(canTransitionWorkStatus("registered", "assigned")).toBe(true);
  });

  it("does not allow a rejected work item to become completed directly", () => {
    expect(canTransitionWorkStatus("rejected", "completed")).toBe(false);
  });

  it("groups completion_reported as review", () => {
    expect(getWorkStatusGroup("completion_reported")).toBe("review");
  });
});
