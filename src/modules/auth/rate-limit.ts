import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { rateLimitEvents } from "../db/schema";
import { logger } from "../logging/logger";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export class RateLimitExceededError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Too many requests. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitExceededError";
  }
}

/**
 * Fixed-window counter, checked/incremented atomically via upsert. No
 * Redis: see docs/audit/PHASE1-ARCHITECTURE.md §8 for why a Postgres table
 * is sufficient at this scale — this app's write volume is human-submitted
 * content, not high-frequency events, so contention on this table is not a
 * realistic concern.
 *
 * `key` is the caller-supplied identity to bucket by — an IP address for
 * anonymous endpoints, a user id for authenticated ones. Throws
 * RateLimitExceededError rather than returning a boolean so callers can't
 * accidentally ignore the result.
 */
export async function checkRateLimit(
  key: string,
  endpoint: string,
  config: RateLimitConfig,
): Promise<void> {
  const db = getDb();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimitEvents)
    .values({ key, endpoint, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [
        rateLimitEvents.key,
        rateLimitEvents.endpoint,
        rateLimitEvents.windowStart,
      ],
      set: { count: sql`${rateLimitEvents.count} + 1` },
    })
    .returning({ count: rateLimitEvents.count });

  if ((row?.count ?? 1) > config.limit) {
    const retryAfterSeconds = Math.ceil(
      (windowStart.getTime() + windowMs - Date.now()) / 1000,
    );
    logger.warn("rate_limit_exceeded", {
      key,
      endpoint,
      count: row?.count,
      limit: config.limit,
    });
    throw new RateLimitExceededError(retryAfterSeconds);
  }
}

// Named limits for every endpoint the brief calls out ("rate limiting on
// auth and submission endpoints", "rate-limit admin-on-behalf creation").
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  passwordResetRequest: { limit: 5, windowSeconds: 60 * 60 },
  submitReview: { limit: 5, windowSeconds: 60 * 60 },
  submitSalary: { limit: 10, windowSeconds: 60 * 60 },
  addCompany: { limit: 10, windowSeconds: 60 * 60 },
  searchCompanies: { limit: 120, windowSeconds: 60 },
  adminOnBehalf: { limit: 20, windowSeconds: 60 * 60 },
  disputeReview: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitConfig>;
