import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPriceCheckAt } from './next-price-check.type.js';

const after = 50 * 60_000;
const now = new Date('2026-10-31T14:30:00Z');

void test('is the age after the last read of the product, to the second', (): void => {
  const checked = new Date('2026-10-31T14:03:20Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: checked, lastRequestedAt: null }, after, now),
    new Date('2026-10-31T14:53:20Z'),
  );
});

void test('counts from the later of the last read and the last request', (): void => {
  const checked = new Date('2026-10-31T13:00:00Z');
  const requested = new Date('2026-10-31T14:10:00Z');

  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: checked, lastRequestedAt: requested }, after, now),
    new Date('2026-10-31T15:00:00Z'),
  );
});

void test('is now for a product nothing has touched', (): void => {
  assert.deepEqual(
    nextPriceCheckAt({ lastCheckedAt: null, lastRequestedAt: null }, after, now),
    now,
  );
});

void test('stays in the past for a product that is overdue, so that it reads as soon', (): void => {
  const long = new Date('2026-10-30T10:00:00Z');
  const next = nextPriceCheckAt({ lastCheckedAt: long, lastRequestedAt: long }, after, now);

  assert.ok(next !== null && next < now);
});

void test('is unknown when the refresh is off', (): void => {
  assert.equal(nextPriceCheckAt({ lastCheckedAt: null, lastRequestedAt: null }, 0, now), null);
});
