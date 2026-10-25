import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProxyEndpointEntity } from './proxy-endpoint.entity.js';

void test('rejects private proxy destinations and unsupported protocols', (): void => {
  for (const input of [
    'http://127.0.0.1:8080',
    'http://10.1.2.3:80',
    'socks4://217.71.230.103:1080',
    'http://localhost:8080',
    'socks5://user:secret@217.71.230.103:1080',
  ]) {
    assert.throws((): ProxyEndpointEntity => new ProxyEndpointEntity(input));
  }

  const proxy = new ProxyEndpointEntity('http://user:secret@217.71.230.103:8080');
  assert.equal(proxy.server, 'http://217.71.230.103:8080');
  assert.equal(proxy.password, 'secret');

  assert.equal(
    new ProxyEndpointEntity('http://217.71.230.103:80').server,
    'http://217.71.230.103:80',
  );
  assert.equal(
    new ProxyEndpointEntity('https://217.71.230.103:443').server,
    'https://217.71.230.103:443',
  );
});
