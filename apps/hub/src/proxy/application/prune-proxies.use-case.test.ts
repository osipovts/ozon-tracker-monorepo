import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryProxyRepositoryAdapter } from '../infrastructure/in-memory-proxy-repository.adapter.js';
import {
  manualProxySource,
  ProxyEntity,
  proxyFailureLimit,
  proxyUnseenLimitMs,
} from '../domain/proxy.entity.js';
import { ListProxiesToRecheckUseCase } from './list-proxies-to-recheck.use-case.js';
import { PruneProxiesUseCase } from './prune-proxies.use-case.js';

const now = new Date('2026-11-02T00:00:00Z');
const old = new Date(now.getTime() - proxyUnseenLimitMs - 1000);

function proxy(n: number, overrides: Partial<ConstructorParameters<typeof ProxyEntity>[0]>): ProxyEntity {
  return new ProxyEntity({
    server: `socks5://198.51.100.${String(n)}:1080`,
    source: 'proxifly',
    country: null,
    exitIp: null,
    alive: false,
    latencyMs: null,
    checksTotal: proxyFailureLimit,
    checksAlive: 0,
    lastCheckedAt: old,
    lastSeenAt: old,
    disabledAt: null,
    credentials: null,
    ...overrides,
  });
}

void test('drops only the dead found proxies that no list names, and keeps the rest', async (): Promise<void> => {
  const proxies = new InMemoryProxyRepositoryAdapter();
  await proxies.saveMany([
    proxy(1, {}),
    proxy(2, { alive: true }),
    proxy(3, { checksTotal: proxyFailureLimit - 1 }),
    proxy(4, { lastSeenAt: now }),
    proxy(5, { source: manualProxySource }),
  ]);

  assert.equal(await new PruneProxiesUseCase(proxies).execute(now), 1);
  assert.deepEqual(
    (await proxies.list({}, { page: 1, pageSize: 10 })).items.map((item): string => item.snapshot.server).toSorted(),
    [2, 3, 4, 5].map((n): string => `socks5://198.51.100.${String(n)}:1080`),
  );
  assert.equal(await new PruneProxiesUseCase(proxies).execute(now), 0);
});

void test('lists the found proxies no list has named lately, the longest unchecked first, up to a limit', async (): Promise<void> => {
  const proxies = new InMemoryProxyRepositoryAdapter();
  const day = 24 * 60 * 60 * 1000;
  await proxies.saveMany([
    proxy(1, { alive: true, lastCheckedAt: new Date(now.getTime() - 2 * day) }),
    proxy(2, { alive: true, lastCheckedAt: new Date(now.getTime() - 3 * day) }),
    proxy(3, { alive: true, lastSeenAt: now }),
    proxy(4, { alive: true, source: manualProxySource }),
  ]);

  const recheck = new ListProxiesToRecheckUseCase(proxies);

  assert.deepEqual(await recheck.execute(now, 60_000, 10), [
    'socks5://198.51.100.2:1080',
    'socks5://198.51.100.1:1080',
  ]);
  assert.deepEqual(await recheck.execute(now, 60_000, 1), ['socks5://198.51.100.2:1080']);
});
