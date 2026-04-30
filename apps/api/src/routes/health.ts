import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";

export type HealthResponse = {
  status: "ok";
  database: "configured";
  fileStorage: "configured";
  agentRunner: "configured" | "disabled";
};

export function registerHealthRoutes(app: FastifyInstance, config: AppConfig) {
  app.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    database: "configured",
    fileStorage: "configured",
    agentRunner: config.agentRunner.enabled ? "configured" : "disabled",
  }));
}
