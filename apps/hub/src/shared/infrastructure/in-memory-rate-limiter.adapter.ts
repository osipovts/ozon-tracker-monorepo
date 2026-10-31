import { type ClockPort, systemClock } from '../application/clock.port.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
  RateLimitVerdictInterface,
} from '../application/rate-limiter.port.js';

/** Counts in the memory of this process: for the tests, and for a hub that runs as one instance. */
export class InMemoryRateLimiterAdapter implements RateLimiterPort {
  private readonly windows = new Map<string, { hits: number; endsAt: number }>();

  constructor(private readonly clock: ClockPort = systemClock) {}

  hit(key: string, { limit, windowMs }: RateLimitInterface): Promise<RateLimitVerdictInterface> {
    const now = this.clock.now().getTime();
    const known = this.windows.get(key);
    const window =
      known !== undefined && known.endsAt > now ? known : { hits: 0, endsAt: now + windowMs };
    window.hits += 1;
    this.windows.set(key, window);

    return Promise.resolve(
      window.hits <= limit
        ? { allowed: true, retryAfterMs: 0 }
        : { allowed: false, retryAfterMs: window.endsAt - now },
    );
  }
}
