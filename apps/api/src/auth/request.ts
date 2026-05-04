import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import type { AuthStore, AuthUser } from "./session.js";
import { sessionCookieName } from "./session.js";

export async function getAuthenticatedUser(
  request: FastifyRequest,
  config: AppConfig,
  authStore: AuthStore,
): Promise<AuthUser | null> {
  const signedSessionId = request.cookies[sessionCookieName(config.nodeEnv)];
  if (!signedSessionId) return null;

  const unsigned = request.unsignCookie(signedSessionId);
  if (!unsigned.valid || !unsigned.value) return null;

  return authStore.findSessionUser(unsigned.value);
}
