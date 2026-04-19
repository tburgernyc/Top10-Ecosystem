import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter for the admin gate — 5 attempts per 10 minutes per IP.
 * Uses Upstash Redis for serverless-compatible sliding window rate limiting.
 */
export const adminGateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  analytics: true,
  prefix: 'toptenprom:admin-gate',
});
