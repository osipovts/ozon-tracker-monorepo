import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { BrowserSessionInterface } from '../../domain/session/browser-session.interface.js';
import { InMemorySessionStoreAdapter } from './in-memory-session-store.adapter.js';

const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
const cookie = {
  name: 'abt',
  value: 'v1',
  domain: '.ozon.ru',
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
} as const;
const session: BrowserSessionInterface = {
  id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  exitIp: '217.71.230.103',
  userAgent: 'Mozilla/5.0',
  storageState: { cookies: [cookie], origins: [] },
};

void test('finds a session by route, including the direct one', (): void => {
  const store = new InMemorySessionStoreAdapter([{ proxy, session }]);
  assert.equal(store.find(proxy), session);
  assert.equal(store.find(null), null);

  const direct = new InMemorySessionStoreAdapter([{ proxy: null, session }]);
  assert.equal(direct.find(null), session);
  assert.equal(direct.find(proxy), null);
});

void test('reports the last state of every known session once', (): void => {
  const store = new InMemorySessionStoreAdapter([{ proxy, session }]);
  const changed = { cookies: [{ ...cookie, value: 'v2' }], origins: [] };

  store.update(session.id, { cookies: [], origins: [] });
  store.update(session.id, changed);
  store.update('6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22', changed);

  assert.deepEqual(store.drainUpdates(), [{ sessionId: session.id, storageState: changed }]);
  assert.deepEqual(store.drainUpdates(), []);
});

void test('reports an exit address mismatch once', (): void => {
  const store = new InMemorySessionStoreAdapter([{ proxy, session }]);

  store.reject(session.id, '198.51.100.7');

  assert.deepEqual(store.drainMismatches(), [
    { sessionId: session.id, expectedIp: '217.71.230.103', actualIp: '198.51.100.7' },
  ]);
  assert.deepEqual(store.drainMismatches(), []);
});
