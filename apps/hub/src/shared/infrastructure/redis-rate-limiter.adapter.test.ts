import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { Redis } from 'ioredis';

import { RedisRateLimiterAdapter } from './redis-rate-limiter.adapter.js';

/** Needs a Redis: set TEST_REDIS_URL to run it (never one with data that matters). */
const url = process.env['TEST_REDIS_URL'];
const skip = url === undefined ? 'TEST_REDIS_URL is not set' : false;

let redis: Redis;
let limiter: RedisRateLimiterAdapter;

before((): void => {
  if (url === undefined) return;

  redis = new Redis(url);
  limiter = new RedisRateLimiterAdapter(redis);
});

after(async (): Promise<void> => {
  if (url !== undefined) await redis.quit();
});

void test(
  'counts the hits of a key in a window shared by every instance of the hub',
  { skip },
  async (): Promise<void> => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 2, windowMs: 5_000 };

    assert.equal((await limiter.hit(key, rule)).allowed, true);
    assert.equal((await limiter.hit(key, rule)).allowed, true);

    const refused = await limiter.hit(key, rule);
    assert.equal(refused.allowed, false);
    assert.ok(refused.retryAfterMs > 0 && refused.retryAfterMs <= 5_000);
    assert.equal((await limiter.hit(`${key}:other`, rule)).allowed, true);
  },
);

void test('opens the window again once it has passed', { skip }, async (): Promise<void> => {
  const key = `test:${randomUUID()}`;
  const rule = { limit: 1, windowMs: 200 };
  await limiter.hit(key, rule);
  assert.equal((await limiter.hit(key, rule)).allowed, false);

  await new Promise((resolve): void => {
    setTimeout(resolve, 300);
  });

  assert.equal((await limiter.hit(key, rule)).allowed, true);
});
