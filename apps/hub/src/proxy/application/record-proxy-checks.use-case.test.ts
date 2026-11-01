import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEntity } from '../domain/proxy.entity.js';
import type { ProxyCheckInterface } from '../domain/proxy-check.interface.js';
import { InMemoryProxyRepositoryAdapter } from '../infrastructure/in-memory-proxy-repository.adapter.js';
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
    seen: true,
    ...overrides,
  };
}

void test('creates a proxy from its first check', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();

  await new RecordProxyChecksUseCase(repository).execute([check({})]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.snapshot.alive, true);
  assert.equal(proxy.snapshot.latencyMs, 300);
  assert.equal(proxy.snapshot.checksTotal, 1);
  assert.equal(proxy.successRate, 1);
});

void test('keeps the last known location and latency when a proxy dies', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();
  const useCase = new RecordProxyChecksUseCase(repository);

  await useCase.execute([check({})]);
  await useCase.execute([
    check({
      alive: false,
      latencyMs: null,
      country: null,
      exitIp: null,
      checkedAt: new Date('2026-10-24T12:05:00.000Z'),
    }),
  ]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.snapshot.alive, false);
  assert.equal(proxy.snapshot.country, 'RU');
  assert.equal(proxy.snapshot.latencyMs, 300);
  assert.equal(proxy.snapshot.checksTotal, 2);
  assert.equal(proxy.successRate, 0.5);
});

void test('applies several checks of one proxy in a batch in order', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();

  await new RecordProxyChecksUseCase(repository).execute([
    check({}),
    check({ latencyMs: 100, checkedAt: new Date('2026-10-24T12:01:00.000Z') }),
    check({ alive: false, latencyMs: null, checkedAt: new Date('2026-10-24T12:02:00.000Z') }),
  ]);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.snapshot.checksTotal, 3);
  assert.equal(proxy.snapshot.checksAlive, 2);
  assert.equal(proxy.snapshot.alive, false);
  assert.equal(proxy.snapshot.latencyMs, 100);
});

void test('counts a batch once, however many times the queue delivers it', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();
  const useCase = new RecordProxyChecksUseCase(repository);
  const batch = [
    check({ checkedAt: new Date('2026-10-24T12:00:00.000Z') }),
    check({ checkedAt: new Date('2026-10-24T12:05:00.000Z'), alive: false }),
  ];

  await useCase.execute(batch);
  await useCase.execute(batch);

  const [proxy] = await repository.findByServers([server]);
  assert.equal(proxy?.snapshot.checksTotal, 2);
  assert.equal(proxy.successRate, 0.5);
});

void test('does not undo a proxy turned off while the batch was being handled', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();
  await new RecordProxyChecksUseCase(repository).execute([
    check({ checkedAt: new Date('2026-10-24T12:00:00.000Z') }),
  ]);
  const [read] = await repository.findByServers([server]);
  assert.ok(read !== undefined);
  // An administrator turns it off after the batch has read it and before it is saved.
  await repository.saveMany([read.disabled(new Date('2026-10-24T12:30:00.000Z'))]);

  await repository.saveChecked([
    ProxyEntity.fromCheck(check({ checkedAt: new Date('2026-10-24T13:00:00.000Z') }), read),
  ]);

  const [after] = await repository.findByServers([server]);
  assert.ok(after !== undefined);
  assert.notEqual(after.snapshot.disabledAt, null);
  assert.equal(after.snapshot.checksTotal, 2);
});

void test('a recheck of a proxy that is gone does not bring it back', async (): Promise<void> => {
  const repository = new InMemoryProxyRepositoryAdapter();

  await new RecordProxyChecksUseCase(repository).execute([check({ seen: false })]);

  assert.deepEqual(await repository.findByServers([server]), []);
});
