import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { getServerListenOptions } from "./server.js";

function serverTestEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    API_ORIGIN: "http://localhost:3000",
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

describe("getServerListenOptions", () => {
  it("binds localhost origins to loopback by default", () => {
    expect(getServerListenOptions(loadConfig(serverTestEnv()))).toEqual({
      host: "127.0.0.1",
      port: 3000,
    });
  });

  it("allows explicit all-interface binding for container deployments", () => {
    expect(getServerListenOptions(loadConfig(serverTestEnv({ BIND_HOST: "0.0.0.0" })))).toEqual({
      host: "0.0.0.0",
      port: 3000,
    });
  });

  it("does not derive listen port from the public API origin", () => {
    expect(getServerListenOptions(loadConfig(serverTestEnv({ API_ORIGIN: "https://api.company.local" })))).toEqual({
      host: "127.0.0.1",
      port: 3000,
    });
  });
});
