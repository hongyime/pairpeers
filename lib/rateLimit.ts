/**
 * Best-effort per-IP sliding-window rate limiter for pilot abuse resistance.
 *
 * NOTE: this is per serverless instance (in-memory). It meaningfully throttles
 * brute-force enumeration of the 6-character code space (32^6 ≈ 1B combos)
 * but is not a global limiter — a shared store (e.g. Upstash Redis) is the
 * production path. Correctness of single-use redemption never depends on this;
 * the atomic `redeem_invite` function owns that.
 */

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

// Prune occasionally to bound memory.
let ops = 0;

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (++ops % 1000 === 0) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart > windowMs) buckets.delete(k);
    }
  }
  const b = buckets.get(key);
  if (!b || now - b.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (b.count < maxRequests) {
    b.count++;
    return { allowed: true, retryAfterMs: 0 };
  }
  return { allowed: false, retryAfterMs: b.windowStart + windowMs - now };
}

/** Client IP for rate-limit keys (Vercel-aware). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
