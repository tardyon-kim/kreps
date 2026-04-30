import { describe, expect, it } from "vitest";
import { InMemoryLoginAttemptLimiter } from "./rate-limit.js";

function failureBucketCounts(limiter: InMemoryLoginAttemptLimiter) {
  const internals = limiter as unknown as {
    accountFailures: Map<string, number[]>;
    sourceFailures: Map<string, number[]>;
  };

  return {
    accounts: internals.accountFailures.size,
    sources: internals.sourceFailures.size,
    hasAccount: (email: string) => internals.accountFailures.has(email),
  };
}

describe("InMemoryLoginAttemptLimiter", () => {
  it("does not allocate buckets for fresh checks without failures", () => {
    const limiter = new InMemoryLoginAttemptLimiter();
    const now = new Date("2026-04-30T00:00:00.000Z");

    expect(limiter.check({ email: "new@example.local", source: "127.0.0.1" }, now)).toEqual({ allowed: true });

    expect(failureBucketCounts(limiter)).toMatchObject({
      accounts: 0,
      sources: 0,
    });
  });

  it("blocks by source before allocating unique account buckets", () => {
    const limiter = new InMemoryLoginAttemptLimiter({
      maxFailures: 1,
      windowMs: 60_000,
    });
    const now = new Date("2026-04-30T00:00:00.000Z");

    limiter.recordFailure({ email: "known@example.local", source: "127.0.0.1" }, now);

    expect(limiter.check({ email: "unique@example.local", source: "127.0.0.1" }, now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(failureBucketCounts(limiter)).toMatchObject({
      accounts: 1,
      sources: 1,
    });
    expect(failureBucketCounts(limiter).hasAccount("unique@example.local")).toBe(false);
  });
});
