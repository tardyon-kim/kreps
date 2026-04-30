import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

function configTestEnv(overrides: Record<string, string | undefined> = {}) {
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

describe("loadConfig", () => {
  it("parses every environment key used by the API", () => {
    expect(loadConfig(configTestEnv())).toEqual({
      nodeEnv: "test",
      appOrigin: "http://localhost:5173",
      apiOrigin: "http://localhost:3000",
      bindHost: "127.0.0.1",
      bindPort: 3000,
      databaseUrl: "postgres://kreps:kreps_dev_password@localhost:5432/kreps_test",
      postgresImage: "postgres:16",
      sessionSecret: "test-session-secret-with-at-least-32-characters",
      fileStorageDir: "./tmp/files",
      maxUploadBytes: 26214400,
      defaultLocale: "ko",
      defaultTimeZone: "Asia/Seoul",
      agentRunner: {
        enabled: false,
        url: null,
        timeoutMs: 120000,
      },
    });
  });

  it("requires an Agent Runner URL when the runner is enabled", () => {
    expect(() => loadConfig(configTestEnv({ AGENT_RUNNER_ENABLED: "true", AGENT_RUNNER_URL: "" }))).toThrow(
      /AGENT_RUNNER_URL/,
    );
  });

  it("rejects the documented session secret placeholder in production", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          NODE_ENV: "production",
          SESSION_SECRET: "replace-with-at-least-32-random-characters",
        }),
      ),
    ).toThrow(/SESSION_SECRET/);
  });

  it("requires https origins in production", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          NODE_ENV: "production",
          APP_ORIGIN: "http://app.company.local",
          API_ORIGIN: "https://api.company.local",
        }),
      ),
    ).toThrow(/APP_ORIGIN and API_ORIGIN/);
  });

  it("normalizes origin strings for browser Origin header matching", () => {
    expect(
      loadConfig(
        configTestEnv({
          APP_ORIGIN: "https://app.company.local/",
          API_ORIGIN: "https://api.company.local/",
        }),
      ),
    ).toMatchObject({
      appOrigin: "https://app.company.local",
      apiOrigin: "https://api.company.local",
    });
  });

  it("rejects Agent Runner URLs outside the internal trust boundary", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          AGENT_RUNNER_ENABLED: "true",
          AGENT_RUNNER_URL: "https://api.example.com/runner",
        }),
      ),
    ).toThrow(/AGENT_RUNNER_URL/);
  });

  it("rejects Agent Runner URLs with credentials or fragments", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          AGENT_RUNNER_ENABLED: "true",
          AGENT_RUNNER_URL: "http://runner:secret@localhost:8787/start#token",
        }),
      ),
    ).toThrow(/AGENT_RUNNER_URL/);
  });

  it("rejects public IPv6 Agent Runner URLs", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          AGENT_RUNNER_ENABLED: "true",
          AGENT_RUNNER_URL: "http://[2606:4700:4700::1111]/runner",
        }),
      ),
    ).toThrow(/AGENT_RUNNER_URL/);
  });

  it("rejects non-http origins", () => {
    expect(() => loadConfig(configTestEnv({ APP_ORIGIN: "ftp://localhost", API_ORIGIN: "postgres://localhost/db" }))).toThrow(
      /ORIGIN/,
    );
  });

  it("rejects origins with credentials", () => {
    expect(() =>
      loadConfig(
        configTestEnv({
          APP_ORIGIN: "http://user:pass@localhost:5173",
          API_ORIGIN: "http://admin:secret@localhost:3000",
        }),
      ),
    ).toThrow(/ORIGIN/);
  });
});
