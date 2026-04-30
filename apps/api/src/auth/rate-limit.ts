export type LoginAttemptKey = {
  email: string;
  source: string;
};

export type LoginAttemptLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

export type LoginAttemptLimiter = {
  check(key: LoginAttemptKey, now?: Date): LoginAttemptLimitResult;
  recordFailure(key: LoginAttemptKey, now?: Date): void;
  resetAccount(email: string): void;
};

export type InMemoryLoginAttemptLimiterOptions = {
  maxFailures?: number;
  windowMs?: number;
};

export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  private readonly accountFailures = new Map<string, number[]>();
  private readonly sourceFailures = new Map<string, number[]>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(options: InMemoryLoginAttemptLimiterOptions = {}) {
    this.maxFailures = Math.max(1, options.maxFailures ?? 10);
    this.windowMs = Math.max(1000, options.windowMs ?? 15 * 60 * 1000);
  }

  check(key: LoginAttemptKey, now = new Date()): LoginAttemptLimitResult {
    const sourceStatus = this.checkBucket(this.sourceFailures, key.source, now.getTime());
    if (!sourceStatus.allowed) {
      return sourceStatus;
    }

    const accountStatus = this.checkBucket(this.accountFailures, normalizeEmail(key.email), now.getTime());
    if (accountStatus.allowed) {
      return { allowed: true };
    }

    return accountStatus;
  }

  recordFailure(key: LoginAttemptKey, now = new Date()) {
    this.record(this.accountFailures, normalizeEmail(key.email), now.getTime());
    this.record(this.sourceFailures, key.source, now.getTime());
  }

  resetAccount(email: string) {
    this.accountFailures.delete(normalizeEmail(email));
  }

  private checkBucket(failuresByKey: Map<string, number[]>, key: string, nowMs: number) {
    const existingFailures = failuresByKey.get(key);
    const failures = this.prune(existingFailures ?? [], nowMs);
    if (failures.length === 0) {
      if (existingFailures) {
        failuresByKey.delete(key);
      }

      return { allowed: true as const };
    }

    failuresByKey.set(key, failures);
    if (failures.length < this.maxFailures) {
      return { allowed: true as const };
    }

    const firstFailureAt = failures[0];
    if (firstFailureAt === undefined) {
      return { allowed: true as const };
    }

    const retryAfterMs = firstFailureAt + this.windowMs - nowMs;
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  private record(failuresByKey: Map<string, number[]>, key: string, nowMs: number) {
    const failures = this.prune(failuresByKey.get(key) ?? [], nowMs);
    failures.push(nowMs);
    failuresByKey.set(key, failures);
  }

  private prune(failures: readonly number[], nowMs: number) {
    const cutoff = nowMs - this.windowMs;
    return failures.filter((failureAt) => failureAt > cutoff);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
