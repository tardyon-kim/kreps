import { describe, expect, it } from "vitest";
import type { AppConfig } from "../config.js";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { dummyPasswordHash, hashPassword } from "./password.js";
import { InMemoryLoginAttemptLimiter } from "./rate-limit.js";
import type { AuthRouteDependencies } from "./routes.js";
import type { AuthSession, AuthStore, AuthUser } from "./session.js";
import { sessionCookieName } from "./session.js";

function authTestEnv(overrides: Record<string, string | undefined> = {}) {
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

class MemoryAuthStore implements AuthStore {
  readonly sessions = new Map<string, AuthSession>();
  private readonly usersByEmail = new Map<string, AuthUser>();
  private readonly usersById = new Map<string, AuthUser>();

  constructor(users: readonly AuthUser[]) {
    for (const user of users) {
      this.usersByEmail.set(user.email, user);
      this.usersById.set(user.id, user);
    }
  }

  async findUserByEmail(email: string) {
    return this.usersByEmail.get(email) ?? null;
  }

  async createSession(session: AuthSession) {
    this.sessions.set(session.id, session);
  }

  async findSessionUser(sessionId: string, now = new Date()) {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt <= now) return null;

    return this.usersById.get(session.userId) ?? null;
  }
}

async function buildAuthTestApp(config: AppConfig, authRoutes?: AuthRouteDependencies) {
  const user: AuthUser = {
    id: "00000000-0000-4000-8000-000000000103",
    organizationId: "00000000-0000-4000-8000-000000000002",
    email: "employee@example.local",
    displayName: "Employee",
    passwordHash: await hashPassword("ChangeMe123!"),
    locale: "en",
    theme: "system",
    status: "active",
  };
  const authStore = new MemoryAuthStore([user]);
  const app = buildApp(config, { authStore, authRoutes });

  return { app, authStore };
}

describe("auth routes", () => {
  it("sets an HTTP-only session cookie on login and returns the current user", async () => {
    const config = loadConfig(authTestEnv());
    const { app, authStore } = await buildAuthTestApp(config);

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "employee@example.local",
          password: "ChangeMe123!",
        },
      });

      expect(loginResponse.statusCode).toBe(200);
      expect(loginResponse.json()).toMatchObject({
        user: {
          id: "00000000-0000-4000-8000-000000000103",
          email: "employee@example.local",
          displayName: "Employee",
        },
      });
      expect(loginResponse.json().user.passwordHash).toBeUndefined();
      expect(authStore.sessions.size).toBe(1);

      const setCookie = loginResponse.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieHeader).toContain(`${sessionCookieName(config.nodeEnv)}=`);
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader).toContain("SameSite=Lax");
      expect(cookieHeader).toContain("Path=/");

      const sessionCookie = cookieHeader?.split(";")[0];
      const meResponse = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: sessionCookie,
        },
      });

      expect(meResponse.statusCode).toBe(200);
      expect(meResponse.json()).toMatchObject({
        user: {
          id: "00000000-0000-4000-8000-000000000103",
          email: "employee@example.local",
          displayName: "Employee",
        },
      });
      expect(meResponse.json().user.passwordHash).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("uses a browser-valid __Host cookie only for production", () => {
    expect(sessionCookieName("test")).toBe("kreps_session");
    expect(sessionCookieName("production")).toBe("__Host-kreps_session");
  });

  it("sets a secure __Host session cookie in production", async () => {
    const config = loadConfig(
      authTestEnv({
        NODE_ENV: "production",
        APP_ORIGIN: "https://app.company.local",
        API_ORIGIN: "https://api.company.local",
      }),
    );
    const { app } = await buildAuthTestApp(config);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "employee@example.local",
          password: "ChangeMe123!",
        },
      });

      const setCookie = response.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(response.statusCode).toBe(200);
      expect(cookieHeader).toContain("__Host-kreps_session=");
      expect(cookieHeader).toContain("Secure");
      expect(cookieHeader).toContain("Path=/");
    } finally {
      await app.close();
    }
  });

  it("rejects login with a wrong password", async () => {
    const { app } = await buildAuthTestApp(loadConfig(authTestEnv()));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "employee@example.local",
          password: "WrongPassword123!",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("checks the attempt limiter before password verification", async () => {
    let verifyCalls = 0;
    const { app, authStore } = await buildAuthTestApp(loadConfig(authTestEnv()), {
      loginAttemptLimiter: new InMemoryLoginAttemptLimiter({
        maxFailures: 1,
        windowMs: 60_000,
      }),
      verifyPassword: async () => {
        verifyCalls += 1;
        return false;
      },
    });

    try {
      const firstResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "employee@example.local",
          password: "WrongPassword123!",
        },
      });
      const secondResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "employee@example.local",
          password: "WrongPassword123!",
        },
      });

      expect(firstResponse.statusCode).toBe(401);
      expect(secondResponse.statusCode).toBe(429);
      expect(secondResponse.headers["retry-after"]).toBe("60");
      expect(verifyCalls).toBe(1);
      expect(authStore.sessions.size).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("runs dummy password verification for missing accounts", async () => {
    const verifierInputs: string[] = [];
    const { app } = await buildAuthTestApp(loadConfig(authTestEnv()), {
      verifyPassword: async (_password, storedHash) => {
        verifierInputs.push(storedHash);
        return false;
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "missing@example.local",
          password: "WrongPassword123!",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(verifierInputs).toEqual([dummyPasswordHash]);
    } finally {
      await app.close();
    }
  });
});
