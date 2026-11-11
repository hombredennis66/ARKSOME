/**
 * Small in-memory sliding-window rate limiter.
 *
 * Good enough for a single Node instance (Vercel serverless functions are
 * short-lived, so abuse windows reset between cold starts — the database
 * unique constraints remain the hard backstop for reward claims).
 */

type Bucket = { hits: number[] };

const store = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup to keep memory bounded.
  if (store.size > MAX_BUCKETS) {
    for (const [k, bucket] of store) {
      if (bucket.hits.every((t) => now - t > windowMs)) store.delete(k);
    }
  }

  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    store.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Convenience wrapper: `assertRateLimit('reward', userId, { limit, windowMs })`. */
export function assertRateLimit(bucket: string, identifier: string, cfg: { limit: number; windowMs: number }) {
  return rateLimit(`${bucket}:${identifier}`, cfg.limit, cfg.windowMs);
}
