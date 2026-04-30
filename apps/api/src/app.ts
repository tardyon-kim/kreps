import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";

export function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: config.nodeEnv === "production",
  });

  app.get("/api", async () => ({
    status: "ok",
  }));

  registerHealthRoutes(app, config);

  return app;
}
