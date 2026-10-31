import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPriceCheckAt } from './next-price-check.type.js';

const policy = { intervalMs: 900_000, maxAgeMs: 6 * 3_600_000 };
const now = new Date('2026-10-31T12:00:00Z');

void test('is the maximum age after the later of the last read and the last request', (): void => {
  const checked = new Date('2026-10-31T09:00:00Z');
  const requested = new Date('2026-10-31T10:00:00Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: checked, lastRequestedAt: requested }, policy, now),
    new Date('2026-10-31T16:00:00Z'),
  );
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: requested, lastRequestedAt: checked }, policy, now),
    new Date('2026-10-31T16:00:00Z'),
  );
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: null, lastRequestedAt: requested }, policy, now),
    new Date('2026-10-31T16:00:00Z'),
  );
});

void test('is now for a product nothing has touched', (): void => {
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: null, lastRequestedAt: null }, policy, now),
    now,
  );
});

void test('says a time that has passed for a product that is overdue', (): void => {
  const long = new Date('2026-10-30T00:00:00Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: long, lastRequestedAt: long }, policy, now),
    new Date('2026-10-30T06:00:00Z'),
  );
});

void test('is unknown when the schedule is off', (): void => {
  assert.equal(
    nextPriceCheckAt(
      { lastCheckedAt: now, lastRequestedAt: now },
      { ...policy, intervalMs: 0 },
      now,
    ),
    null,
  );
});
