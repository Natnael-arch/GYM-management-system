// A simple in-memory sliding window rate limiter
// Note: In a multi-node production deployment, you'd use Redis.
// Since this is deployed on a single local server, an in-memory Map is sufficient.

type RateLimitInfo = {
  count: number;
  resetTime: number;
};

const globalForRateLimit = globalThis as unknown as {
  rateLimits: Map<string, RateLimitInfo> | undefined;
};

const limits = globalForRateLimit.rateLimits ?? new Map<string, RateLimitInfo>();
if (process.env.NODE_ENV !== 'production') globalForRateLimit.rateLimits = limits;

export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = limits.get(ip);

  // Clean up stale entries occasionally (very naive cleanup)
  if (Math.random() < 0.05) {
    for (const [key, value] of limits.entries()) {
      if (value.resetTime < now) {
        limits.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    limits.set(ip, { count: 1, resetTime: now + windowMs });
    return true; // Allowed
  }

  if (record.count >= limit) {
    return false; // Rate limited
  }

  record.count += 1;
  return true; // Allowed
}
