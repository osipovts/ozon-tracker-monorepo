import type { Redis } from 'ioredis';
import { z } from 'zod';

import type {
  RateLimiterPort,
  RateLimitInterface,
  RateLimitVerdictInterface,
} from '../application/rate-limiter.port.js';

/** One atomic step: the hit, the start of the window with the first one, and the time it has left. */
const hitScript = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { hits, redis.call('PTTL', KEYS[1]) }
`;

const replySchema = z.tuple([z.number().int(), z.number().int()]);

/** Counts in Redis, so that every instance of the hub shares the windows. */
export class RedisRateLimiterAdapter implements RateLimiterPort {
  constructor(private readonly redis: Redis) {}

  async hit(
    key: string,
    { limit, windowMs }: RateLimitInterface,
  ): Promise<RateLimitVerdictInterface> {
    const [hits, timeLeftMs] = replySchema.parse(
      await this.redis.eval(hitScript, 1, `rate-limit:${key}`, windowMs),
    );

    return hits <= limit
      ? { allowed: true, retryAfterMs: 0 }
      : { allowed: false, retryAfterMs: Math.max(0, timeLeftMs) };
  }
}
