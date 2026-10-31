import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPriceCheckAt, type PriceRefreshPolicyInterface } from './next-price-check.type.js';

const hour = 3_600_000;
const hourly: PriceRefreshPolicyInterface = {
  schedule: { kind: 'hourly', minute: 55 },
  maxAgeMs: hour,
};
const interval: PriceRefreshPolicyInterface = {
  schedule: { kind: 'interval', intervalMs: 900_000 },
  maxAgeMs: 6 * hour,
};
const now = new Date('2026-10-31T14:30:00Z');

void test('at a minute of the hour it is the first run after the last read or request', (): void => {
  const checked = new Date('2026-10-31T13:56:00Z');
  const requested = new Date('2026-10-31T14:10:00Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: checked, lastRequestedAt: requested }, hourly, now),
    new Date('2026-10-31T14:55:00Z'),
  );
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: checked, lastRequestedAt: null }, hourly, now),
    new Date('2026-10-31T14:55:00Z'),
  );
});

void test('a product read at the minute of a run waits for the run of the next hour', (): void => {
  const readAt = new Date('2026-10-31T14:55:20Z');

  assert.deepEqual(
    nextPriceCheckAt(
      { lastCheckedAt: readAt, lastRequestedAt: readAt },
      hourly,
      new Date('2026-10-31T14:56:00Z'),
    ),
    new Date('2026-10-31T15:55:00Z'),
  );
});

void test('a product nothing has touched, or an overdue one, waits for the next run', (): void => {
  const long = new Date('2026-10-30T00:00:00Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: null, lastRequestedAt: null }, hourly, now),
    new Date('2026-10-31T14:55:00Z'),
  );
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: long, lastRequestedAt: long }, hourly, now),
    new Date('2026-10-31T14:55:00Z'),
  );
});

void test('with a longer maximum age it is the last run before the price would outlive it', (): void => {
  const readAt = new Date('2026-10-31T14:56:00Z');
  const threeHours = { ...hourly, maxAgeMs: 3 * hour };

  // Read at 14:56, it would be 3 hours old at 17:56: the run of 17:55 is the last before that.
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: readAt, lastRequestedAt: readAt }, threeHours, readAt),
    new Date('2026-10-31T17:55:00Z'),
  );
});

void test('at an interval it is the time the product is due, as the schedule sees it', (): void => {
  const readAt = new Date('2026-10-31T09:00:00Z');

  // 6 hours of maximum age less the 15 minutes until the next look.
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: readAt, lastRequestedAt: readAt }, interval, now),
    new Date('2026-10-31T14:45:00Z'),
  );
});

void test('is unknown when the schedule is off', (): void => {
  assert.equal(
    nextPriceCheckAt(
      { lastCheckedAt: now, lastRequestedAt: now },
      { schedule: { kind: 'off' }, maxAgeMs: hour },
      now,
    ),
    null,
  );
});
