import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { dummyPasswordHash, verifyPassword as defaultVerifyPassword } from "./password.js";
import { InMemoryLoginAttemptLimiter, type LoginAttemptLimiter } from "./rate-limit.js";
import type { AuthStore } from "./session.js";
import { createSession, sessionCookieName, sessionCookieOptions, toPublicAuthUser } from "./session.js";

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

type PasswordVerifier = (password: string, storedHash: string) => Promise<boolean>;

export type AuthRouteDependencies = {
  loginAttemptLimiter?: LoginAttemptLimiter;
  verifyPassword?: PasswordVerifier;
};

export function registerAuthRoutes(
  app: FastifyInstance,
  config: AppConfig,
  authStore: AuthStore,
  dependencies: AuthRouteDependencies = {},
) {
  const loginAttemptLimiter = dependencies.loginAttemptLimiter ?? new InMemoryLoginAttemptLimiter();
  const verifyPassword = dependencies.verifyPassword ?? defaultVerifyPassword;

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_login_request" });
    }

    const loginAttemptKey = {
      email: parsed.data.email,
      source: request.ip,
    };
    const rateLimit = loginAttemptLimiter.check(loginAttemptKey);
    if (!rateLimit.allowed) {
      return reply
        .header("retry-after", rateLimit.retryAfterSeconds.toString())
        .code(429)
        .send({ error: "too_many_login_attempts" });
    }

    const user = await authStore.findUserByEmail(parsed.data.email);
    const passwordHash = user?.status === "active" ? user.passwordHash : dummyPasswordHash;
    const passwordMatches = await verifyPassword(parsed.data.password, passwordHash);

    if (!user || user.status !== "active" || !passwordMatches) {
      loginAttemptLimiter.recordFailure(loginAttemptKey);
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    loginAttemptLimiter.resetAccount(parsed.data.email);
    const session = createSession(user.id);
    await authStore.createSession(session);

    return reply
      .setCookie(sessionCookieName(config.nodeEnv), session.id, sessionCookieOptions(config.nodeEnv, session.expiresAt))
      .send({ user: toPublicAuthUser(user) });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const signedSessionId = request.cookies[sessionCookieName(config.nodeEnv)];
    if (!signedSessionId) {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    const unsigned = request.unsignCookie(signedSessionId);
    if (!unsigned.valid || !unsigned.value) {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    const user = await authStore.findSessionUser(unsigned.value);
    if (!user) {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    return reply.send({ user: toPublicAuthUser(user) });
  });
}
