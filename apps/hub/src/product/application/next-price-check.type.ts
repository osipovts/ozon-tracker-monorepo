import type { TrackedProductInterface } from '../domain/tracked-product.entity.js';

/**
 * When the price of a product is read again: `refreshAfterMs` after the last read or request of it, so a
 * product is never read sooner than that. A time that has passed means the product waits for the next look
 * of the schedule. A product nothing has touched is due now. Null when the refresh is off (a zero age).
 */
export function nextPriceCheckAt(
  product: Pick<TrackedProductInterface, 'lastCheckedAt' | 'lastRequestedAt'>,
  refreshAfterMs: number,
  now: Date,
): Date | null {
  if (refreshAfterMs <= 0) return null;

  const touches = [product.lastCheckedAt, product.lastRequestedAt].flatMap((at): number[] =>
    at === null ? [] : [at.getTime()],
  );

  return touches.length === 0 ? now : new Date(Math.max(...touches) + refreshAfterMs);
}
