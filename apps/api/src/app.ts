import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AuthRouteDependencies } from "./auth/routes.js";
import type { AuthStore } from "./auth/session.js";
import type { AppConfig } from "./config.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerHealthRoutes } from "./routes/health.js";

export type AppDependencies = {
  authStore?: AuthStore;
  authRoutes?: AuthRouteDependencies;
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
  }

  registerHealthRoutes(app, config);

  return app;
}
