import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEntity } from './proxy.entity.js';

const checkedAt = new Date('2026-10-31T10:00:00Z');
const disabledAt = new Date('2026-10-31T11:00:00Z');

function proxy(overrides: Partial<ReturnType<typeof snapshot>> = {}): ProxyEntity {
  return new ProxyEntity({ ...snapshot(), ...overrides });
}

function snapshot(): ConstructorParameters<typeof ProxyEntity>[0] {
  return {
    server: 'socks5://217.71.230.1:1080',
    source: 'github-free-proxy-list',
    country: 'RU',
    exitIp: '217.71.230.1',
    alive: true,
    latencyMs: 120,
    checksTotal: 4,
    checksAlive: 3,
    lastCheckedAt: checkedAt,
    disabledAt: null,
    credentials: null,
  };
}

void test('an administrator turns a proxy off and on again, without touching what was checked', (): void => {
  const off = proxy().disabled(disabledAt);

  assert.deepEqual(off.snapshot.disabledAt, disabledAt);
  assert.equal(off.snapshot.alive, true);
  assert.equal(off.enabled().snapshot.disabledAt, null);
  // Turning it off twice keeps the first time.
  assert.deepEqual(
    off.disabled(new Date(disabledAt.getTime() + 1000)).snapshot.disabledAt,
    disabledAt,
  );
});

void test('a check does not turn a proxy back on, dead or alive: only an administrator does', (): void => {
  const off = proxy().disabled(disabledAt);
  const alive = {
    server: off.snapshot.server,
    source: 'github-free-proxy-list',
    alive: true,
    latencyMs: 90,
    country: 'RU',
    exitIp: '217.71.230.1',
    checkedAt: new Date('2026-10-31T12:00:00Z'),
  };
  const dead = { ...alive, alive: false, latencyMs: null, country: null, exitIp: null };

  assert.deepEqual(ProxyEntity.fromCheck(alive, off).snapshot.disabledAt, disabledAt);
  assert.deepEqual(ProxyEntity.fromCheck(dead, off).snapshot.disabledAt, disabledAt);
  assert.equal(ProxyEntity.fromCheck(alive).snapshot.disabledAt, null);
});
