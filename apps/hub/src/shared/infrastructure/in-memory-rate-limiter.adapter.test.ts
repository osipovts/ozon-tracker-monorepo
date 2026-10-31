import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClockPort } from '../application/clock.port.js';
import { InMemoryRateLimiterAdapter } from './in-memory-rate-limiter.adapter.js';

const minute = 60_000;
const rule = { limit: 3, windowMs: 10 * minute };

function setup(): { limiter: InMemoryRateLimiterAdapter; at: (minutes: number) => void } {
  let current = new Date('2026-10-31T10:00:00Z');
  const clock: ClockPort = { now: (): Date => current };

  return {
    limiter: new InMemoryRateLimiterAdapter(clock),
    at: (minutes): void => {
      current = new Date(new Date('2026-10-31T10:00:00Z').getTime() + minutes * minute);
    },
  };
}

void test('lets the limit through, then refuses with the time left of the window', async (): Promise<void> => {
  const { limiter, at } = setup();

  for (let hit = 0; hit < 3; hit += 1) {
    assert.deepEqual(await limiter.hit('login:jane', rule), { allowed: true, retryAfterMs: 0 });
  }

  at(4);
  assert.deepEqual(await limiter.hit('login:jane', rule), {
    allowed: false,
    retryAfterMs: 6 * minute,
  });
});

void test('a refused hit does not stretch the window', async (): Promise<void> => {
  const { limiter, at } = setup();
  for (let hit = 0; hit < 3; hit += 1) await limiter.hit('login:jane', rule);

  at(5);
  await limiter.hit('login:jane', rule);
  await limiter.hit('login:jane', rule);

  at(10);
  assert.equal((await limiter.hit('login:jane', rule)).allowed, true);
});

void test('counts every key on its own', async (): Promise<void> => {
  const { limiter } = setup();
  for (let hit = 0; hit < 4; hit += 1) await limiter.hit('login:jane', rule);

  assert.equal((await limiter.hit('login:jane', rule)).allowed, false);
  assert.equal((await limiter.hit('login:sam', rule)).allowed, true);
});
