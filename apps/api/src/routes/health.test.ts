import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";

function healthTestEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    API_ORIGIN: "http://localhost:3000",
    BIND_HOST: "127.0.0.1",
    BIND_PORT: "3000",
    DATABASE_URL: "postgres://kreps:kreps_dev_password@localhost:5432/kreps_test",
    POSTGRES_IMAGE: "postgres:16",
    SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
    FILE_STORAGE_DIR: "./tmp/files",
    MAX_UPLOAD_BYTES: "26214400",
    DEFAULT_LOCALE: "ko",
    DEFAULT_TIME_ZONE: "Asia/Seoul",
    AGENT_RUNNER_ENABLED: "false",
    AGENT_RUNNER_URL: "",
    AGENT_RUNNER_TIMEOUT_MS: "120000",
    ...overrides,
  };
}

describe("GET /health", () => {
  it("keeps API JSON routes under /api", async () => {
    const app = buildApp(loadConfig(healthTestEnv()));

    try {
      const response = await app.inject({ method: "GET", url: "/api" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "ok" });
    } finally {
      await app.close();
    }
  });

  it("reports configured dependencies with the Agent Runner disabled", async () => {
    const app = buildApp(loadConfig(healthTestEnv()));

    try {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: "ok",
        database: "configured",
        fileStorage: "configured",
        agentRunner: "disabled",
      });
    } finally {
      await app.close();
    }
  });
});
