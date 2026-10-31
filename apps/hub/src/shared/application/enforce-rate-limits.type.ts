import type { RateLimiterPort, RateLimitInterface } from './rate-limiter.port.js';
import { TooManyRequestsError } from './too-many-requests.error.js';

/**
 * Counts an attempt against every key, and refuses it, with the longest wait, if any key is over its
 * limit. All the keys are counted even when one refuses, so that a refusal is no free try at the others.
 */
export async function enforceRateLimits(
  limiter: RateLimiterPort,
  hits: ReadonlyArray<readonly [key: string, rule: RateLimitInterface]>,
): Promise<void> {
  const verdicts = [];
  for (const [key, rule] of hits) verdicts.push(await limiter.hit(key, rule));

  const refused = verdicts.filter((verdict): boolean => !verdict.allowed);
  if (refused.length > 0) {
    throw new TooManyRequestsError(
      Math.max(...refused.map((verdict): number => verdict.retryAfterMs)),
    );
  }
}
