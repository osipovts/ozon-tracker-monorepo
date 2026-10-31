import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { silentLogger } from 'logger';

import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';
import { PeriodicPriceRefreshAdapter } from './periodic-price-refresh.adapter.js';

type RefreshType = Pick<RefreshPricesUseCase, 'execute'>;

function counting(): { refresh: RefreshType; calls: () => number } {
  let calls = 0;

  return {
    refresh: {
      execute: (): Promise<{ products: number; jobs: number }> => {
        calls += 1;

        return Promise.resolve({ products: 0, jobs: 0 });
      },
    },
    calls: (): number => calls,
  };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

void test('refreshes when the hub starts and then every interval, until it shuts down', async (): Promise<void> => {
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { kind: 'interval', intervalMs: 40 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(150);
  assert.ok(calls() >= 3, `refreshed ${String(calls())} times`);

  await adapter.onApplicationShutdown();
  const stopped = calls();
  await wait(100);
  assert.equal(stopped, calls());
});

void test('of the instances of the hub that share a Redis only one refreshes in a window', async (): Promise<void> => {
  const shared = new InMemoryRateLimiterAdapter();
  const [first, second] = [counting(), counting()];
  const adapters = [
    new PeriodicPriceRefreshAdapter(
      first.refresh,
      shared,
      { kind: 'interval', intervalMs: 10_000 },
      silentLogger,
    ),
    new PeriodicPriceRefreshAdapter(
      second.refresh,
      shared,
      { kind: 'interval', intervalMs: 10_000 },
      silentLogger,
    ),
  ];

  for (const adapter of adapters) adapter.onApplicationBootstrap();
  await wait(30);
  for (const adapter of adapters) await adapter.onApplicationShutdown();

  assert.equal(first.calls() + second.calls(), 1);
});

void test('is off when the schedule is off', async (): Promise<void> => {
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { kind: 'off' },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(50);
  await adapter.onApplicationShutdown();

  assert.equal(calls(), 0);
});

void test('a refresh that fails is logged and tried again at the next interval', async (): Promise<void> => {
  let calls = 0;
  const warnings: string[] = [];
  const failing: RefreshType = {
    execute: (): Promise<{ products: number; jobs: number }> => {
      calls += 1;

      return Promise.reject(new Error('database is down'));
    },
  };
  const adapter = new PeriodicPriceRefreshAdapter(
    failing,
    new InMemoryRateLimiterAdapter(),
    { kind: 'interval', intervalMs: 30 },
    {
      ...silentLogger,
      warn: (message: string): void => {
        warnings.push(message);
      },
    },
  );

  adapter.onApplicationBootstrap();
  await wait(110);
  await adapter.onApplicationShutdown();

  assert.ok(calls >= 2);
  assert.ok(warnings.length >= 2);
  assert.match(warnings[0] ?? '', /database is down/);
});

const settle = (): Promise<void> =>
  new Promise((resolve): void => {
    setImmediate(resolve);
  });

/** A run of the 13:55 slot, as the limiter of a hub that went down afterwards remembers it. */
async function ranAtSlot(limiter: InMemoryRateLimiterAdapter): Promise<void> {
  await limiter.hit('price-refresh:run', { limit: 1, windowMs: 54 * 60_000 });
}

void test('at a minute of the hour it runs at that minute of every hour, and not when the hub starts after a run', async (t: TestContext): Promise<void> => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 9, 31, 13, 55) });
  const { refresh, calls } = counting();
  const limiter = new InMemoryRateLimiterAdapter();
  await ranAtSlot(limiter);
  t.mock.timers.tick(25 * 60_000);
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    limiter,
    { kind: 'hourly', minute: 55 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await settle();
  assert.equal(calls(), 0, 'at 14:20, the 13:55 slot was run');

  t.mock.timers.tick(34 * 60_000);
  await settle();
  assert.equal(calls(), 0, 'not yet at 14:54');

  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(calls(), 1, 'at 14:55');

  t.mock.timers.tick(60 * 60_000);
  await settle();
  assert.equal(calls(), 2, 'at 15:55');

  await adapter.onApplicationShutdown();
  t.mock.timers.tick(2 * 60 * 60_000);
  await settle();
  assert.equal(calls(), 2, 'not after it shuts down');
});

void test('a hub that was down at the minute runs the missed slot when it starts, and keeps the next one', async (t: TestContext): Promise<void> => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 9, 31, 14, 20) });
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { kind: 'hourly', minute: 55 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await settle();
  assert.equal(calls(), 1, 'at 14:20, nothing ran at 13:55');

  t.mock.timers.tick(35 * 60_000);
  await settle();
  assert.equal(calls(), 2, 'the late run does not hold back 14:55');

  await adapter.onApplicationShutdown();
});

void test('a hub that starts just before the next slot leaves it to the slot', async (t: TestContext): Promise<void> => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 9, 31, 14, 52) });
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { kind: 'hourly', minute: 55 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await settle();
  assert.equal(calls(), 0, 'at 14:52');

  t.mock.timers.tick(3 * 60_000);
  await settle();
  assert.equal(calls(), 1, 'at 14:55');

  await adapter.onApplicationShutdown();
});
