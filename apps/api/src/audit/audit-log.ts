import type { WorkStatus } from "@kreps/shared";
import type { DatabaseClient } from "../db/client.js";
import { auditEvents } from "../db/schema.js";

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

export type AuditLogStore = {
  recordAudit(entry: AuditLogInput): Promise<void>;
};

export function createAuditLogEntry(input: AuditLogInput): AuditLogEntry {
  return {
    ...input,
    createdAt: input.createdAt ?? new Date(),
  };
}

export function auditLogInsertValues(input: AuditLogInput) {
  const entry = createAuditLogEntry(input);
  return {
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    createdAt: entry.createdAt,
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

export class PostgresAuditLogStore implements AuditLogStore {
  constructor(private readonly db: DatabaseClient["db"]) {}

  async recordAudit(input: AuditLogInput) {
    await this.db.insert(auditEvents).values(auditLogInsertValues(input));
  }
}
