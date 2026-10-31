import assert from 'node:assert/strict';
import { test } from 'node:test';

import { silentLogger } from 'logger';
import type { ProxySourceType } from 'queue-contract';

import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';
import { PeriodicProxyRefreshAdapter } from './periodic-proxy-refresh.adapter.js';

type RefreshType = Pick<RefreshProxySourceUseCase, 'execute'>;

const settings = { intervalMs: 10_000, maxCandidates: 150, probeTimeoutMs: 8000 };

function recording(failing?: ProxySourceType): {
  refresh: RefreshType;
  calls: Array<[ProxySourceType, number, number, string | null]>;
} {
  const calls: Array<[ProxySourceType, number, number, string | null]> = [];

  return {
    calls,
    refresh: {
      execute: (source, options, requestedBy): Promise<{ jobId: string }> => {
        if (source === failing) return Promise.reject(new Error('redis is down'));
        calls.push([source, options.maxCandidates, options.probeTimeoutMs, requestedBy]);

        return Promise.resolve({ jobId: 'job' });
      },
    },
  };
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, ms);
  });

void test('queues every source with the settings when the hub starts, for no user', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    settings,
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.deepEqual(calls, [
    ['github-free-proxy-list', 150, 8000, null],
    ['proxifly', 150, 8000, null],
    ['proxyscrape', 150, 8000, null],
  ]);
});

void test('a source that cannot be queued does not keep the others from it', async (): Promise<void> => {
  const { refresh, calls } = recording('proxifly');
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    settings,
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.deepEqual(
    calls.map(([source]): ProxySourceType => source),
    ['github-free-proxy-list', 'proxyscrape'],
  );
});

void test('repeats every interval until it shuts down', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { ...settings, intervalMs: 50 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(200);
  await adapter.onApplicationShutdown();

  // The window is shorter than the interval, so a run is allowed in each of them.
  assert.ok(calls.length >= 6, `queued ${String(calls.length)} refreshes`);
  const stopped = calls.length;
  await wait(100);
  assert.equal(calls.length, stopped);
});

void test('of the instances of the hub that share a Redis only one queues in a window', async (): Promise<void> => {
  const shared = new InMemoryRateLimiterAdapter();
  const [first, second] = [recording(), recording()];
  const adapters = [first, second].map(
    ({ refresh }): PeriodicProxyRefreshAdapter =>
      new PeriodicProxyRefreshAdapter(refresh, shared, settings, silentLogger),
  );

  for (const adapter of adapters) adapter.onApplicationBootstrap();
  await wait(30);
  for (const adapter of adapters) await adapter.onApplicationShutdown();

  assert.equal(first.calls.length + second.calls.length, 3);
});

void test('does nothing when the interval is 0', async (): Promise<void> => {
  const { refresh, calls } = recording();
  const adapter = new PeriodicProxyRefreshAdapter(
    refresh,
    new InMemoryRateLimiterAdapter(),
    { ...settings, intervalMs: 0 },
    silentLogger,
  );

  adapter.onApplicationBootstrap();
  await wait(30);
  await adapter.onApplicationShutdown();

  assert.equal(calls.length, 0);
});
