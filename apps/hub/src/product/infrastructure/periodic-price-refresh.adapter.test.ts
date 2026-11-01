import assert from 'node:assert/strict';
import { test } from 'node:test';

import { silentLogger } from 'logger';

import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';
import { PeriodicPriceRefreshAdapter } from './periodic-price-refresh.adapter.js';

type RefreshType = Pick<RefreshPricesUseCase, 'execute'>;

const hour = 3_600_000;

/** Gives the batches of products it is told to, one per run, then none. */
function counting(batches: number[] = []): { refresh: RefreshType; calls: () => number } {
  let calls = 0;

  return {
    refresh: {
      execute: (): Promise<{ products: number; jobs: number }> => {
        const products = batches[calls] ?? 0;
        calls += 1;

        return Promise.resolve({ products, jobs: products > 0 ? 1 : 0 });
      },
    },
    calls: (): number => calls,
  };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

void test('looks for the due prices when the hub starts and then on every poll, until it shuts down', async (): Promise<void> => {
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { pollMs: 40, refreshAfterMs: hour },
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

void test('when the hub starts it catches up: it goes on until nothing is due, a batch after a batch', async (): Promise<void> => {
  const { refresh, calls } = counting([200, 200, 30]);
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { pollMs: 10_000, refreshAfterMs: hour },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(50);
  await adapter.onApplicationShutdown();

  assert.equal(calls(), 4);
});

void test('of the instances of the hub that share a Redis only one refreshes in a poll', async (): Promise<void> => {
  const shared = new InMemoryRateLimiterAdapter();
  const [first, second] = [counting(), counting()];
  const settings = { pollMs: 10_000, refreshAfterMs: hour };
  const adapters = [
    new PeriodicPriceRefreshAdapter(first.refresh, shared, settings, silentLogger),
    new PeriodicPriceRefreshAdapter(second.refresh, shared, settings, silentLogger),
  ];

  for (const adapter of adapters) adapter.onApplicationBootstrap();
  await wait(30);
  for (const adapter of adapters) await adapter.onApplicationShutdown();

  assert.equal(first.calls() + second.calls(), 1);
});

void test('does not start a poll while the previous one is still running', async (): Promise<void> => {
  let calls = 0;
  const slow: RefreshType = {
    execute: async (): Promise<{ products: number; jobs: number }> => {
      calls += 1;
      await wait(120);

      return { products: 0, jobs: 0 };
    },
  };
  const adapter = new PeriodicPriceRefreshAdapter(
    slow,
    new InMemoryRateLimiterAdapter(),
    { pollMs: 30, refreshAfterMs: hour },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(100);
  await adapter.onApplicationShutdown();

  assert.equal(calls, 1);
});

void test('is off when the age is zero', async (): Promise<void> => {
  const { refresh, calls } = counting();
  const adapter = new PeriodicPriceRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { pollMs: 10, refreshAfterMs: 0 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(50);
  await adapter.onApplicationShutdown();

  assert.equal(calls(), 0);
});

void test('a refresh that fails is logged and tried again at the next poll', async (): Promise<void> => {
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
    { pollMs: 30, refreshAfterMs: hour },
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
