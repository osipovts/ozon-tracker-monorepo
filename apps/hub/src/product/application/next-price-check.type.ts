import type { TrackedProductInterface } from '../domain/tracked-product.entity.js';

export interface PriceRefreshPolicyInterface {
  /** How often the schedule looks for stale prices; 0 turns the schedule off. */
  intervalMs: number;
  /** A price older than this is read again. */
  maxAgeMs: number;
}

/**
 * When the schedule reads the price of a product again, about: the product is due once both its last
 * read and its last request are older than the maximum age, and the schedule notices at its next look,
 * which is up to one interval later. A time that has passed means the product waits for that look.
 * Null when the schedule is off.
 */
export function nextPriceCheckAt(
  product: Pick<TrackedProductInterface, 'lastCheckedAt' | 'lastRequestedAt'>,
  policy: PriceRefreshPolicyInterface,
  now: Date,
): Date | null {
  if (policy.intervalMs === 0) return null;

  const touches = [product.lastCheckedAt, product.lastRequestedAt].flatMap((at): number[] =>
    at === null ? [] : [at.getTime()],
  );
  if (touches.length === 0) return now;

  return new Date(Math.max(...touches) + policy.maxAgeMs);
}
