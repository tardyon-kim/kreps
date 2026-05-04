import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthenticatedUser } from "../../auth/request.js";
import type { AuthStore } from "../../auth/session.js";
import type { AppConfig } from "../../config.js";
import {
  OrganizationCodeConflictError,
  OrganizationParentNotFoundError,
  isPermissionDenied,
  type OrganizationService,
} from "./organization.service.js";

const createOrganizationBodySchema = z.object({
  parentId: z.string().uuid().nullable().optional().default(null),
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/),
  defaultLocale: z.enum(["ko", "en"]).default("ko"),
});

export function registerOrganizationRoutes(
  app: FastifyInstance,
  config: AppConfig,
  authStore: AuthStore,
  organizationService: OrganizationService,
) {
  app.get("/api/organizations/tree", async (request, reply) => {
    const user = await getAuthenticatedUser(request, config, authStore);
    if (!user) return reply.code(401).send({ error: "not_authenticated" });

    try {
      const organizations = await organizationService.getTree(user);
      return reply.send({ organizations });
    } catch (error) {
      if (isPermissionDenied(error)) return reply.code(403).send({ error: "permission_denied" });
      throw error;
    }
  });

  app.post("/api/organizations", async (request, reply) => {
    const user = await getAuthenticatedUser(request, config, authStore);
    if (!user) return reply.code(401).send({ error: "not_authenticated" });

    const parsed = createOrganizationBodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request" });

    try {
      const organization = await organizationService.createOrganization(user, parsed.data);
      return reply.code(201).send({ organization });
    } catch (error) {
      if (isPermissionDenied(error)) return reply.code(403).send({ error: "permission_denied" });
      if (error instanceof OrganizationCodeConflictError) {
        return reply.code(409).send({ error: "organization_code_conflict" });
      }
      if (error instanceof OrganizationParentNotFoundError) {
        return reply.code(404).send({ error: "organization_parent_not_found" });
      }
      throw error;
    }
  });
}
