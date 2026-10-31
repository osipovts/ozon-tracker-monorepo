import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import express from 'express';

import { serveStaticUi } from './static-ui.type.js';

let directory = '';
let server: Server;
let origin = '';

before(async (): Promise<void> => {
  directory = await mkdtemp(join(tmpdir(), 'panel-'));
  await writeFile(join(directory, 'index.html'), '<p>panel page</p>');
  await writeFile(join(directory, 'app.js'), 'console.log(1)');

  const app = express();
  serveStaticUi(app, '/panel', directory);
  app.get('/proxies', (_request, response): void => {
    response.json({ api: true });
  });
  await new Promise<void>((resolve): void => {
    server = app.listen(0, '127.0.0.1', (): void => {
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No port');
  origin = `http://127.0.0.1:${String(address.port)}`;
});

after(async (): Promise<void> => {
  await new Promise<void>((resolve): void => {
    server.close((): void => {
      resolve();
    });
  });
  await rm(directory, { recursive: true });
});

void test('serves the files of the panel and its page for a route the panel draws itself', async (): Promise<void> => {
  const script = await fetch(`${origin}/panel/app.js`);
  assert.equal(script.status, 200);
  assert.equal(await script.text(), 'console.log(1)');

  const route = await fetch(`${origin}/panel/proxies`);
  assert.equal(route.status, 200);
  assert.equal(await route.text(), '<p>panel page</p>');
});

void test('shuts the panel off from other origins and from frames', async (): Promise<void> => {
  const reply = await fetch(`${origin}/panel/`);

  assert.equal(reply.headers.get('x-frame-options'), 'DENY');
  assert.equal(reply.headers.get('referrer-policy'), 'no-referrer');
  assert.match(reply.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
});

void test('leaves the paths outside of /panel to the API', async (): Promise<void> => {
  const reply = await fetch(`${origin}/proxies`);

  assert.deepEqual(await reply.json(), { api: true });
  assert.equal(reply.headers.get('x-frame-options'), null);
});

void test('answers a write under /panel with not found, not with the page', async (): Promise<void> => {
  const reply = await fetch(`${origin}/panel/proxies`, { method: 'POST' });

  assert.equal(reply.status, 404);
});

void test('lets the pictures in from the origins it is given, and from no others', async (): Promise<void> => {
  const app = express();
  serveStaticUi(app, '/app', directory, ['https://files.example.com']);
  const listening = await new Promise<Server>((resolve): void => {
    const started = app.listen(0, '127.0.0.1', (): void => {
      resolve(started);
    });
  });
  const address = listening.address();
  if (address === null || typeof address === 'string') throw new Error('No port');

  const reply = await fetch(`http://127.0.0.1:${String(address.port)}/app/`);
  const policy = reply.headers.get('content-security-policy') ?? '';
  await new Promise<void>((resolve): void => {
    listening.close((): void => {
      resolve();
    });
  });

  assert.match(policy, /img-src 'self' https:\/\/files\.example\.com data:/);
  assert.match(policy, /default-src 'self'/);
});
