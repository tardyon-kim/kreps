import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAuthenticatedUser } from "../../auth/request.js";
import type { AuthStore } from "../../auth/session.js";
import type { AppConfig } from "../../config.js";
import { UserNotFoundError, isPermissionDenied, type UserService } from "./user.service.js";

const userParamsSchema = z.object({
  id: z.string().uuid(),
});

const preferencesBodySchema = z
  .object({
    locale: z.enum(["ko", "en"]).optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
  })
  .refine((value) => value.locale !== undefined || value.theme !== undefined);

export function registerUserRoutes(
  app: FastifyInstance,
  config: AppConfig,
  authStore: AuthStore,
  userService: UserService,
) {
  app.get("/api/users", async (request, reply) => {
    const user = await getAuthenticatedUser(request, config, authStore);
    if (!user) return reply.code(401).send({ error: "not_authenticated" });

    try {
      const users = await userService.listUsers(user);
      return reply.send({ users });
    } catch (error) {
      if (isPermissionDenied(error)) return reply.code(403).send({ error: "permission_denied" });
      throw error;
    }
  });

  app.patch("/api/users/:id/preferences", async (request, reply) => {
    const user = await getAuthenticatedUser(request, config, authStore);
    if (!user) return reply.code(401).send({ error: "not_authenticated" });

    const params = userParamsSchema.safeParse(request.params);
    const body = preferencesBodySchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_request" });

    try {
      const updated = await userService.updatePreferences(user, params.data.id, body.data);
      return reply.send({ user: updated });
    } catch (error) {
      if (isPermissionDenied(error)) return reply.code(403).send({ error: "permission_denied" });
      if (error instanceof UserNotFoundError) return reply.code(404).send({ error: "user_not_found" });
      throw error;
    }
  });
}
