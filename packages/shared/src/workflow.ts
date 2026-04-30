export const workStatuses = [
  "draft",
  "registered",
  "awaiting_review",
  "approved",
  "assigned",
  "in_progress",
  "on_hold",
  "completion_reported",
  "rejected",
  "completed",
  "cancelled",
] as const;

export type WorkStatus = (typeof workStatuses)[number];

export type WorkStatusGroup = "waiting" | "active" | "review" | "done" | "blocked";

export const workStatusGroups: Record<WorkStatusGroup, readonly WorkStatus[]> = {
  waiting: ["draft", "registered", "awaiting_review", "approved", "assigned"],
  active: ["in_progress"],
  review: ["completion_reported"],
  done: ["completed", "cancelled"],
  blocked: ["on_hold", "rejected"],
};

const allowedTransitions: Record<WorkStatus, readonly WorkStatus[]> = {
  draft: ["registered", "cancelled"],
  registered: ["awaiting_review", "approved", "assigned", "on_hold", "rejected", "cancelled"],
  awaiting_review: ["approved", "rejected", "on_hold", "cancelled"],
  approved: ["assigned", "on_hold", "cancelled"],
  assigned: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completion_reported", "on_hold", "cancelled"],
  on_hold: ["registered", "assigned", "in_progress", "cancelled"],
  completion_reported: ["completed", "rejected", "in_progress"],
  rejected: ["registered", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionWorkStatus(from: WorkStatus, to: WorkStatus) {
  return allowedTransitions[from].includes(to);
}

export function getWorkStatusGroup(status: WorkStatus): WorkStatusGroup {
  for (const [group, statuses] of Object.entries(workStatusGroups)) {
    if (statuses.includes(status)) return group as WorkStatusGroup;
  }

  throw new Error(`Unknown work status: ${status}`);
}
