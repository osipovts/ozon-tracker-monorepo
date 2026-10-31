import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEntity } from '../domain/proxy.entity.js';
import { InMemoryProxyRepositoryAdapter } from '../infrastructure/in-memory-proxy-repository.adapter.js';
import { GetProxyStatsUseCase } from './get-proxy-stats.use-case.js';

function proxy(
  n: number,
  alive: boolean,
  latencyMs: number | null,
  disabled: boolean,
  checked: string,
): ProxyEntity {
  return new ProxyEntity({
    server: `socks5://217.71.230.${String(n)}:1080`,
    source: 'github-free-proxy-list',
    country: 'RU',
    exitIp: null,
    alive,
    latencyMs,
    checksTotal: 1,
    checksAlive: alive ? 1 : 0,
    lastCheckedAt: new Date(checked),
    disabledAt: disabled ? new Date('2026-10-31T09:00:00Z') : null,
  });
}

void test('counts the proxies, the alive and the turned off, the mean latency of the alive and the last check', async (): Promise<void> => {
  const proxies = new InMemoryProxyRepositoryAdapter();
  await proxies.saveMany([
    proxy(1, true, 100, false, '2026-10-31T10:00:00Z'),
    proxy(2, true, 300, true, '2026-10-31T11:00:00Z'),
    proxy(3, false, null, false, '2026-10-31T08:00:00Z'),
  ]);

  assert.deepEqual(await new GetProxyStatsUseCase(proxies).execute(), {
    total: 3,
    alive: 2,
    disabled: 1,
    averageLatencyMs: 200,
    lastCheckedAt: new Date('2026-10-31T11:00:00Z'),
  });
});

void test('has no mean latency and no last check with no proxies', async (): Promise<void> => {
  assert.deepEqual(await new GetProxyStatsUseCase(new InMemoryProxyRepositoryAdapter()).execute(), {
    total: 0,
    alive: 0,
    disabled: 0,
    averageLatencyMs: null,
    lastCheckedAt: null,
  });
});
