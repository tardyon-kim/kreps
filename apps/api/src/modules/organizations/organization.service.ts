import type { Locale } from "@kreps/shared";
import { asc, eq, inArray } from "drizzle-orm";
import type { AuthUser } from "../../auth/session.js";
import { PermissionDeniedError } from "../../auth/rbac.js";
import { auditLogInsertValues, createAuditLogEntry, type AuditLogInput } from "../../audit/audit-log.js";
import type { DatabaseClient } from "../../db/client.js";
import { auditEvents, organizations } from "../../db/schema.js";
import {
  assertActorPermission,
  listActorPermissionGrants,
  listAccessibleOrganizationIds,
  type AccessStore,
  PostgresAccessStore,
} from "../access-control.js";

export type OrganizationRecord = {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  defaultLocale: Locale;
};

export type OrganizationNode = OrganizationRecord & {
  children: OrganizationNode[];
};

export type OrganizationCreateInput = Omit<OrganizationRecord, "id">;

export type OrganizationStore = AccessStore &
  {
    listOrganizations(organizationIds?: readonly string[] | null): Promise<OrganizationRecord[]>;
    findOrganizationByCode(code: string): Promise<OrganizationRecord | null>;
    organizationExists(id: string): Promise<boolean>;
    createOrganizationWithAudit(input: OrganizationCreateInput, audit: AuditLogInput): Promise<OrganizationRecord>;
  };

export class OrganizationService {
  constructor(private readonly store: OrganizationStore) {}

  async getTree(actor: AuthUser) {
    const grants = await listActorPermissionGrants(this.store, actor, "organizations.manage");
    const organizationIds = await listAccessibleOrganizationIds(this.store, actor, grants);
    const rows = await this.store.listOrganizations(organizationIds);
    return buildOrganizationTree(rows);
  }

  async createOrganization(actor: AuthUser, input: OrganizationCreateInput) {
    await assertActorPermission(this.store, actor, "organizations.manage", {
      organizationId: input.parentId,
    });

    if (input.parentId && !(await this.store.organizationExists(input.parentId))) {
      throw new OrganizationParentNotFoundError(input.parentId);
    }
    if (await this.store.findOrganizationByCode(input.code)) {
      throw new OrganizationCodeConflictError(input.code);
    }

    return this.store.createOrganizationWithAudit(
      input,
      createAuditLogEntry({
        actorUserId: actor.id,
        action: "organization.created",
        targetType: "organization",
        targetId: "pending",
        before: {},
        after: {
          name: input.name,
          code: input.code,
          parentId: input.parentId,
          defaultLocale: input.defaultLocale,
        },
      }),
    );
  }
}

export class PostgresOrganizationStore extends PostgresAccessStore implements OrganizationStore {
  constructor(db: DatabaseClient["db"]) {
    super(db);
  }

  async listOrganizations(organizationIds?: readonly string[] | null) {
    if (organizationIds && organizationIds.length === 0) return [];

    const query = this.db
      .select({
        id: organizations.id,
        parentId: organizations.parentId,
        name: organizations.name,
        code: organizations.code,
        defaultLocale: organizations.defaultLocale,
      })
      .from(organizations);

    if (organizationIds) {
      return query.where(inArray(organizations.id, [...organizationIds])).orderBy(asc(organizations.code));
    }

    return query.orderBy(asc(organizations.code));
  }

  async findOrganizationByCode(code: string) {
    const [organization] = await this.db
      .select({
        id: organizations.id,
        parentId: organizations.parentId,
        name: organizations.name,
        code: organizations.code,
        defaultLocale: organizations.defaultLocale,
      })
      .from(organizations)
      .where(eq(organizations.code, code))
      .limit(1);

    return organization ?? null;
  }

  async organizationExists(id: string) {
    const [organization] = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return organization !== undefined;
  }

  async createOrganizationWithAudit(input: OrganizationCreateInput, audit: AuditLogInput) {
    try {
      return await this.db.transaction(async (tx) => {
        const [organization] = await tx
          .insert(organizations)
          .values({
            parentId: input.parentId,
            name: input.name,
            code: input.code,
            defaultLocale: input.defaultLocale,
          })
          .returning({
            id: organizations.id,
            parentId: organizations.parentId,
            name: organizations.name,
            code: organizations.code,
            defaultLocale: organizations.defaultLocale,
          });

        if (!organization) {
          throw new Error("Failed to create organization");
        }

        await tx.insert(auditEvents).values(
          auditLogInsertValues({
            ...audit,
            targetId: organization.id,
            after: {
              name: organization.name,
              code: organization.code,
              parentId: organization.parentId,
              defaultLocale: organization.defaultLocale,
            },
          }),
        );

        return organization;
      });
    } catch (error) {
      if (hasPostgresCode(error, "23505")) throw new OrganizationCodeConflictError(input.code);
      if (input.parentId && hasPostgresCode(error, "23503") && hasPostgresConstraint(error, "organizations_parent_id_fkey")) {
        throw new OrganizationParentNotFoundError(input.parentId);
      }
      throw error;
    }
  }
}

export class OrganizationCodeConflictError extends Error {
  constructor(code: string) {
    super(`Organization code already exists: ${code}`);
    this.name = "OrganizationCodeConflictError";
  }
}

export class OrganizationParentNotFoundError extends Error {
  constructor(parentId: string) {
    super(`Organization parent not found: ${parentId}`);
    this.name = "OrganizationParentNotFoundError";
  }
}

export function buildOrganizationTree(rows: readonly OrganizationRecord[]) {
  const visibleIds = new Set(rows.map((row) => row.id));
  const nodes = new Map<string, OrganizationNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      ...row,
      parentId: row.parentId && visibleIds.has(row.parentId) ? row.parentId : null,
      children: [],
    });
  }

  const roots: OrganizationNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;

    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}

export function isPermissionDenied(error: unknown) {
  return error instanceof PermissionDeniedError;
}

function hasPostgresCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function hasPostgresConstraint(error: unknown, constraint: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "constraint_name" in error &&
    error.constraint_name === constraint
  );
}
