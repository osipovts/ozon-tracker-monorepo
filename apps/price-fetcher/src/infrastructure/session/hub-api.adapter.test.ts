import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';
import { HubApiAdapter } from './hub-api.adapter.js';

const requests: Array<{ method: string; url: string; body: string }> = [];
let status = 201;
let server: Server;
let hub: HubApiAdapter;

before(async (): Promise<void> => {
  server = createServer((request: IncomingMessage, response: ServerResponse): void => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string): void => {
      body += chunk;
    });
    request.on('end', (): void => {
      requests.push({ method: request.method ?? '', url: request.url ?? '', body });
      if (request.method === 'GET') {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ items: [{ server: 'socks5://217.71.230.1:1080' }] }));
        return;
      }
      response.statusCode = status;
      response.end(status === 201 ? '{}' : '{"message":"bad session"}');
    });
  });
  await new Promise<void>((resolve): void => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address: AddressInfo | string | null = server.address();
  assert.ok(address !== null && typeof address === 'object');
  hub = new HubApiAdapter(`http://127.0.0.1:${String(address.port)}`);
});
after((): void => {
  server.close();
});

const captured: CapturedSessionInterface = {
  marketplace: 'ozon',
  proxy: 'socks5://217.71.230.1:1080',
  session: {
    id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
    exitIp: '217.71.230.1',
    userAgent: 'Mozilla/5.0',
    platform: 'linux',
    browserVersion: '148.0.0.0',
    storageState: { cookies: [], origins: [] },
  },
  createdAt: '2026-10-24T12:00:00.000Z',
};

void test('asks the hub for alive Russian proxies without a session', async (): Promise<void> => {
  assert.deepEqual(await hub.listProxiesWithoutSession('ozon', 3), ['socks5://217.71.230.1:1080']);
  const query = new URL(`http://hub${requests.at(-1)?.url ?? ''}`);
  assert.equal(query.pathname, '/proxies');
  assert.deepEqual(Object.fromEntries(query.searchParams), {
    alive: 'true',
    country: 'RU',
    ready: 'false',
    marketplace: 'ozon',
    pageSize: '3',
  });
});

void test('uploads a session and reports a rejection with its reason', async (): Promise<void> => {
  status = 201;
  await hub.uploadSession(captured);
  const upload = requests.at(-1);
  assert.equal(upload?.method, 'POST');
  assert.equal(upload.url, '/sessions');
  assert.ok(upload.body.includes(`"id":"${captured.session.id}"`));
  status = 400;
  await assert.rejects(hub.uploadSession(captured), /HTTP 400 \{"message":"bad session"\}/);
});

void test('names the hub when it cannot be reached', async (): Promise<void> => {
  const closed = createServer();
  await new Promise<void>((resolve): void => {
    closed.listen(0, '127.0.0.1', resolve);
  });
  const address: AddressInfo | string | null = closed.address();
  assert.ok(address !== null && typeof address === 'object');
  await new Promise<void>((resolve): void => {
    closed.close((): void => {
      resolve();
    });
  });
  const unreachable = new HubApiAdapter(`http://127.0.0.1:${String(address.port)}`);
  await assert.rejects(
    unreachable.listProxiesWithoutSession('ozon', 1),
    /Cannot reach the hub at http:\/\/127\.0\.0\.1:\d+ \(ECONNREFUSED\)/,
  );
});
