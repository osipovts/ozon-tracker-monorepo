import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryRateLimiterAdapter } from '../infrastructure/in-memory-rate-limiter.adapter.js';
import type { ClockPort } from './clock.port.js';
import { enforceRateLimits } from './enforce-rate-limits.type.js';
import { TooManyRequestsError } from './too-many-requests.error.js';

const minute = 60_000;
const clock: ClockPort = { now: (): Date => new Date('2026-10-31T10:00:00Z') };

void test('lets the hits through while every key is under its limit', async (): Promise<void> => {
  const limiter = new InMemoryRateLimiterAdapter(clock);

  await enforceRateLimits(limiter, [
    ['a', { limit: 1, windowMs: minute }],
    ['b', { limit: 1, windowMs: minute }],
  ]);
});

void test('refuses with the longest wait when any key is over its limit, and counts all the keys all the same', async (): Promise<void> => {
  const limiter = new InMemoryRateLimiterAdapter(clock);
  await limiter.hit('short', { limit: 1, windowMs: minute });
  await limiter.hit('long', { limit: 1, windowMs: 5 * minute });

  await assert.rejects(
    enforceRateLimits(limiter, [
      ['short', { limit: 1, windowMs: minute }],
      ['long', { limit: 1, windowMs: 5 * minute }],
      ['fresh', { limit: 1, windowMs: minute }],
    ]),
    (error: unknown): boolean => {
      assert.ok(error instanceof TooManyRequestsError);
      assert.equal(error.retryAfterSeconds, 300);

      return true;
    },
  );

  // The key that was fine counted the attempt too: a refusal is no way to hit it for free.
  assert.equal((await limiter.hit('fresh', { limit: 1, windowMs: minute })).allowed, false);
});
