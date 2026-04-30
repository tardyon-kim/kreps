import type { WorkStatus } from "@kreps/shared";

export const auditTargetTypes = ["work_item", "project", "user", "organization", "role", "system"] as const;

export type AuditTargetType = (typeof auditTargetTypes)[number];

export type AuditLogEntry = {
  actorUserId: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export type AuditLogInput = Omit<AuditLogEntry, "createdAt"> & {
  createdAt?: Date;
};

export function createAuditLogEntry(input: AuditLogInput): AuditLogEntry {
  return {
    ...input,
    createdAt: input.createdAt ?? new Date(),
  };
}

export function createWorkItemStatusAudit({
  actorUserId,
  workItemId,
  beforeStatus,
  afterStatus,
  createdAt,
}: {
  actorUserId: string;
  workItemId: string;
  beforeStatus: WorkStatus;
  afterStatus: WorkStatus;
  createdAt?: Date;
}): AuditLogEntry {
  return createAuditLogEntry({
    actorUserId,
    action: "work_item.status_changed",
    targetType: "work_item",
    targetId: workItemId,
    before: { status: beforeStatus },
    after: { status: afterStatus },
    createdAt,
  });
}
