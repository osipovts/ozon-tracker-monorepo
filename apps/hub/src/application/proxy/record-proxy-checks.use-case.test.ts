import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ProxyCheckInterface } from '../../domain/proxy/proxy-check.interface.js';
import { InMemoryProxyRepositoryAdapter } from '../../infrastructure/proxy/in-memory-proxy-repository.adapter.js';
import { RecordProxyChecksUseCase } from './record-proxy-checks.use-case.js';

const server = 'socks5://217.71.230.103:1080';

function check(overrides: Partial<ProxyCheckInterface>): ProxyCheckInterface {
  return {
    server,
    source: 'github-free-proxy-list',
    alive: true,
    latencyMs: 300,
    country: 'RU',
    exitIp: '217.71.230.103',
    checkedAt: new Date('2026-10-24T12:00:00.000Z'),
    ...overrides,
  };
}

void test('creates a proxy from its first check', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();

  await new RecordProxyChecksUseCase(repository).execute([check({})]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.alive, true);
  assert.equal(proxy.latencyMs, 300);
  assert.equal(proxy.checksTotal, 1);
  assert.equal(proxy.successRate, 1);
});

void test('keeps the last known location and latency when a proxy dies', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();
  const useCase = new RecordProxyChecksUseCase(repository);

  await useCase.execute([check({})]);
  await useCase.execute([check({ alive: false, latencyMs: null, country: null, exitIp: null })]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.alive, false);
  assert.equal(proxy.country, 'RU');
  assert.equal(proxy.latencyMs, 300);
  assert.equal(proxy.checksTotal, 2);
  assert.equal(proxy.successRate, 0.5);
});

void test('applies several checks of one proxy in a batch in order', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();

  await new RecordProxyChecksUseCase(repository).execute([
    check({}),
    check({ latencyMs: 100 }),
    check({ alive: false, latencyMs: null }),
  ]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.checksTotal, 3);
  assert.equal(proxy.checksAlive, 2);
  assert.equal(proxy.alive, false);
  assert.equal(proxy.latencyMs, 100);
});
