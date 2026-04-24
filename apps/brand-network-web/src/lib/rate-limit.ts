import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let cachedLimiter: Ratelimit | null = null;

/**
 * Admin gate rate limiter — 5 attempts per 10 minutes per IP.
 * Returns null when Upstash env vars are absent (local dev, preview without secrets)
 * so callers can degrade gracefully instead of crashing at module load.
 */
export function getAdminGateLimiter(): Ratelimit | null {
  if (cachedLimiter) return cachedLimiter;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  cachedLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    analytics: true,
    prefix: 'toptenprom:admin-gate',
  });
  return cachedLimiter;
}
