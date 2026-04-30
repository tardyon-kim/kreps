import { isIP } from "node:net";
import { supportedLocales, type Locale } from "@kreps/shared";
import { z } from "zod";

const booleanFromEnv = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const nullableUrlFromEnv = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().url().nullable(),
);

const httpOriginFromEnv = z.string().url().refine(
  (value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  },
  { message: "must be an http or https origin without path, query, or fragment" },
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: httpOriginFromEnv,
  API_ORIGIN: httpOriginFromEnv,
  BIND_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  BIND_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  POSTGRES_IMAGE: z.string().min(1).default("postgres:16"),
  SESSION_SECRET: z.string().min(32),
  FILE_STORAGE_DIR: z.string().min(1),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26214400),
  DEFAULT_LOCALE: z.enum(supportedLocales).default("ko"),
  DEFAULT_TIME_ZONE: z.string().min(1).default("Asia/Seoul"),
  AGENT_RUNNER_ENABLED: booleanFromEnv.default(false),
  AGENT_RUNNER_URL: nullableUrlFromEnv.default(null),
  AGENT_RUNNER_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
});

const productionSessionSecretPlaceholders = new Set([
  "replace-with-at-least-32-random-characters",
  "change-me",
  "changeme",
]);

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  appOrigin: string;
  apiOrigin: string;
  bindHost: "127.0.0.1" | "0.0.0.0";
  bindPort: number;
  databaseUrl: string;
  postgresImage: string;
  sessionSecret: string;
  fileStorageDir: string;
  maxUploadBytes: number;
  defaultLocale: Locale;
  defaultTimeZone: string;
  agentRunner: {
    enabled: boolean;
    url: string | null;
    timeoutMs: number;
  };
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid API configuration: ${message}`);
  }

  const data = parsed.data;
  if (data.NODE_ENV === "production" && productionSessionSecretPlaceholders.has(data.SESSION_SECRET.toLowerCase())) {
    throw new Error("SESSION_SECRET must not use a documented placeholder in production");
  }

  if (data.NODE_ENV === "production" && (!isHttpsOrigin(data.APP_ORIGIN) || !isHttpsOrigin(data.API_ORIGIN))) {
    throw new Error("APP_ORIGIN and API_ORIGIN must use https in production");
  }

  if (data.AGENT_RUNNER_ENABLED && data.AGENT_RUNNER_URL === null) {
    throw new Error("AGENT_RUNNER_URL is required when AGENT_RUNNER_ENABLED=true");
  }

  if (data.AGENT_RUNNER_URL !== null) {
    validateAgentRunnerUrl(data.AGENT_RUNNER_URL);
  }

  return {
    nodeEnv: data.NODE_ENV,
    appOrigin: normalizeOrigin(data.APP_ORIGIN),
    apiOrigin: normalizeOrigin(data.API_ORIGIN),
    bindHost: data.BIND_HOST,
    bindPort: data.BIND_PORT,
    databaseUrl: data.DATABASE_URL,
    postgresImage: data.POSTGRES_IMAGE,
    sessionSecret: data.SESSION_SECRET,
    fileStorageDir: data.FILE_STORAGE_DIR,
    maxUploadBytes: data.MAX_UPLOAD_BYTES,
    defaultLocale: data.DEFAULT_LOCALE,
    defaultTimeZone: data.DEFAULT_TIME_ZONE,
    agentRunner: {
      enabled: data.AGENT_RUNNER_ENABLED,
      url: data.AGENT_RUNNER_URL,
      timeoutMs: data.AGENT_RUNNER_TIMEOUT_MS,
    },
  };
}

function isHttpsOrigin(value: string) {
  return new URL(value).protocol === "https:";
}

function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

function validateAgentRunnerUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("AGENT_RUNNER_URL must use http or https");
  }

  if (url.username || url.password || url.hash) {
    throw new Error("AGENT_RUNNER_URL must not include credentials or fragments");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!isInternalAgentRunnerHost(host)) {
    throw new Error("AGENT_RUNNER_URL must point to a loopback, private, or internal service host");
  }
}

function isInternalAgentRunnerHost(host: string) {
  if (host === "localhost" || host === "::1") return true;

  if (isIP(host) === 4) {
    return isPrivateIpv4(host);
  }

  if (isIP(host) === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd");
  }

  if (host.includes(".")) {
    return host.endsWith(".local") || host.endsWith(".internal");
  }

  return host.length > 0;
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const first = parts[0];
  const second = parts[1];
  if (first === undefined || second === undefined) {
    return false;
  }

  return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
