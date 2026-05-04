import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AuthRouteDependencies } from "./auth/routes.js";
import type { AuthStore } from "./auth/session.js";
import type { AppConfig } from "./config.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerOrganizationRoutes } from "./modules/organizations/organization.routes.js";
import type { OrganizationService } from "./modules/organizations/organization.service.js";
import { registerUserRoutes } from "./modules/users/user.routes.js";
import type { UserService } from "./modules/users/user.service.js";

export type AppDependencies = {
  authStore?: AuthStore;
  authRoutes?: AuthRouteDependencies;
  organizationService?: OrganizationService;
  userService?: UserService;
};

export function buildApp(config: AppConfig, dependencies: AppDependencies = {}) {
  const app = Fastify({
    logger: config.nodeEnv === "production",
  });

  app.register(cors, {
    origin: config.appOrigin,
    credentials: true,
  });

  app.register(cookie, {
    secret: config.sessionSecret,
  });

  app.get("/api", async () => ({
    status: "ok",
  }));

  if (dependencies.authStore) {
    registerAuthRoutes(app, config, dependencies.authStore, dependencies.authRoutes);
    if (dependencies.organizationService) {
      registerOrganizationRoutes(app, config, dependencies.authStore, dependencies.organizationService);
    }
    if (dependencies.userService) {
      registerUserRoutes(app, config, dependencies.authStore, dependencies.userService);
    }
  }

  registerHealthRoutes(app, config);

  return app;
}
