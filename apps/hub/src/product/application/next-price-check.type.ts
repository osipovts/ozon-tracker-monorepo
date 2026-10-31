import type { TrackedProductInterface } from '../domain/tracked-product.entity.js';
import {
  dueAgeMs,
  nextHourlyRunAfter,
  type PriceRefreshScheduleType,
  schedulePeriodMs,
} from './price-refresh-schedule.type.js';

export interface PriceRefreshPolicyInterface {
  schedule: PriceRefreshScheduleType;
  /** A price must not be older than this. */
  maxAgeMs: number;
}

/**
 * When the schedule reads the price of a product again. At a minute of the hour it is the first run after
 * the product is due, to the minute; at an interval it is the time the product is due, and the next look
 * of the schedule comes up to one interval later. A time that has passed means the product waits for that
 * look. Null when the schedule is off.
 */
export function nextPriceCheckAt(
  product: Pick<TrackedProductInterface, 'lastCheckedAt' | 'lastRequestedAt'>,
  policy: PriceRefreshPolicyInterface,
  now: Date,
): Date | null {
  const { schedule } = policy;
  if (schedule.kind === 'off') return null;

  const touches = [product.lastCheckedAt, product.lastRequestedAt].flatMap((at): number[] =>
    at === null ? [] : [at.getTime()],
  );
  const dueAt =
    touches.length === 0
      ? now
      : new Date(Math.max(...touches) + dueAgeMs(policy.maxAgeMs, schedulePeriodMs(schedule)));

  if (schedule.kind === 'interval') return dueAt;

  return nextHourlyRunAfter(schedule.minute, dueAt > now ? dueAt : now);
}
