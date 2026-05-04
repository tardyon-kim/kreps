import type { FastifyInstance } from "fastify";
import type { AuthSession, AuthStore, AuthUser } from "../auth/session.js";
import { hashPassword } from "../auth/password.js";
import { sessionCookieName } from "../auth/session.js";
import { rbacFixtures } from "./rbac-fixtures.js";

export function apiRouteTestEnv(overrides: Record<string, string | undefined> = {}) {
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

export class MemoryAuthStore implements AuthStore {
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

export async function createRouteTestUsers() {
  const passwordHash = await hashPassword("ChangeMe123!");
  const users: AuthUser[] = [
    {
      id: rbacFixtures.adminUserId,
      organizationId: rbacFixtures.rootOrganizationId,
      email: "admin@example.local",
      displayName: "System Admin",
      passwordHash,
      locale: "ko",
      theme: "system",
      status: "active",
    },
    {
      id: rbacFixtures.employeeUserId,
      organizationId: rbacFixtures.childOrganizationId,
      email: "employee@example.local",
      displayName: "Employee",
      passwordHash,
      locale: "en",
      theme: "system",
      status: "active",
    },
    {
      id: rbacFixtures.managerUserId,
      organizationId: rbacFixtures.childOrganizationId,
      email: "manager@example.local",
      displayName: "Organization Admin",
      passwordHash,
      locale: "ko",
      theme: "system",
      status: "active",
    },
  ];

  return users;
}

export async function loginAndGetCookie(app: FastifyInstance, email: string, nodeEnv = "test") {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email,
      password: "ChangeMe123!",
    },
  });
  const setCookie = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  if (!cookieHeader?.includes(`${sessionCookieName(nodeEnv)}=`)) {
    throw new Error(`Login failed for ${email}: ${response.statusCode} ${response.body}`);
  }

  return cookieHeader.split(";")[0] ?? "";
}
