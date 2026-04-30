import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { DatabaseClient } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

const sessionDurationMs = 1000 * 60 * 60 * 12;

export type AuthUser = {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  locale: "ko" | "en";
  theme: "system" | "light" | "dark";
  status: "active" | "disabled";
};

export type PublicAuthUser = Omit<AuthUser, "passwordHash">;

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export type AuthStore = {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  createSession(session: AuthSession): Promise<void>;
  findSessionUser(sessionId: string, now?: Date): Promise<AuthUser | null>;
};

export function createSession(userId: string, now = new Date()): AuthSession {
  return {
    id: randomBytes(32).toString("base64url"),
    userId,
    expiresAt: new Date(now.getTime() + sessionDurationMs),
  };
}

export function toPublicAuthUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    theme: user.theme,
    status: user.status,
  };
}

export function sessionCookieName(nodeEnv: string) {
  return nodeEnv === "production" ? "__Host-kreps_session" : "kreps_session";
}

export function sessionCookieOptions(nodeEnv: string, expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    signed: true,
    expires: expiresAt,
  };
}

export class PostgresAuthStore implements AuthStore {
  constructor(private readonly db: DatabaseClient["db"]) {}

  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        locale: users.locale,
        theme: users.theme,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async createSession(session: AuthSession) {
    await this.db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
  }

  async findSessionUser(sessionId: string, now = new Date()) {
    const [row] = await this.db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        locale: users.locale,
        theme: users.theme,
        status: users.status,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now), eq(users.status, "active")))
      .limit(1);

    return row ?? null;
  }
}
