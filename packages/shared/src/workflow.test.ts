import { describe, expect, it } from "vitest";
import {
  canTransitionWorkStatus,
  getWorkStatusGroup,
  isWorkStatus,
  workPriorities,
  workStatusGroups,
  workStatuses,
  workStatusTransitions,
} from "./workflow";

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

  it("covers every work status exactly once across status groups", () => {
    const groupedStatuses = Object.values(workStatusGroups).flat();

    expect(groupedStatuses).toHaveLength(workStatuses.length);
    expect(new Set(groupedStatuses)).toEqual(new Set(workStatuses));
  });

  it("exports the canonical transition table including terminal states", () => {
    expect(Object.keys(workStatusTransitions)).toEqual([...workStatuses]);
    expect(workStatusTransitions.registered).toEqual([
      "awaiting_review",
      "approved",
      "assigned",
      "on_hold",
      "rejected",
      "cancelled",
    ]);
    expect(workStatusTransitions.completed).toEqual([]);
    expect(workStatusTransitions.cancelled).toEqual([]);
  });

  it("validates work status strings from API input", () => {
    expect(isWorkStatus("assigned")).toBe(true);
    expect(isWorkStatus("done")).toBe(false);
  });

  it("exports canonical work priorities for API and web filters", () => {
    expect(workPriorities).toEqual(["low", "normal", "high", "urgent"]);
  });
});
