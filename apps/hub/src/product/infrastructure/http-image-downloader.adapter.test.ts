import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { after, before, test } from 'node:test';

import { HttpImageDownloaderAdapter } from './http-image-downloader.adapter.js';

const png = Buffer.from('89504e470d0a1a0a', 'hex');
let server: Server;
let base = '';

function serve(request: IncomingMessage, response: ServerResponse): void {
  switch (request.url) {
    case '/ok.png':
      response.writeHead(200, { 'content-type': 'image/png' }).end(png);
      break;
    case '/page.html':
      response.writeHead(200, { 'content-type': 'text/html' }).end('<p>no</p>');
      break;
    case '/vector.svg':
      response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg/>');
      break;
    case '/announced-big.png':
      response
        .writeHead(200, { 'content-type': 'image/png', 'content-length': String(3 * 1024 * 1024) })
        .end();
      break;
    case '/chunked-big.png': {
      // No length announced: the size is known only by reading.
      response.writeHead(200, { 'content-type': 'image/png' });
      const chunk = Buffer.alloc(512 * 1024);
      for (let sent = 0; sent < 5; sent += 1) response.write(chunk);
      response.end();
      break;
    }
    case '/empty.png':
      response.writeHead(200, { 'content-type': 'image/png' }).end();
      break;
    case '/moved':
      response.writeHead(302, { location: '/ok.png' }).end();
      break;
    case '/loop':
      response.writeHead(302, { location: '/loop' }).end();
      break;
    case '/to-file':
      response.writeHead(302, { location: 'file:///etc/passwd' }).end();
      break;
    default:
      response.writeHead(404).end();
  }
}

before(async (): Promise<void> => {
  server = createServer(serve);
  await new Promise<void>((resolve): void => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  base = `http://127.0.0.1:${String(address.port)}`;
});

after((): void => {
  server.close();
});

/** The tests talk to a server of their own on this machine, which the policy of the hub would refuse. */
const local = new HttpImageDownloaderAdapter({ protocols: ['http:'], allows: (): boolean => true });

void test('downloads a picture with the type the server names', async (): Promise<void> => {
  const image = await local.download(`${base}/ok.png`);

  assert.ok(image !== null);
  assert.equal(image.contentType, 'image/png');
  assert.deepEqual(Buffer.from(image.body), png);
});

void test('follows a redirect to a picture', async (): Promise<void> => {
  assert.equal((await local.download(`${base}/moved`))?.contentType, 'image/png');
});

void test('gives nothing for what is no picture, is empty, is missing, or is vector (which can carry a script)', async (): Promise<void> => {
  for (const path of ['/page.html', '/vector.svg', '/empty.png', '/missing.png'])
    assert.equal(await local.download(`${base}${path}`), null, path);
});

void test('gives nothing for a file that is too big, whether it announces its size or not', async (): Promise<void> => {
  assert.equal(await local.download(`${base}/announced-big.png`), null);
  assert.equal(await local.download(`${base}/chunked-big.png`), null);
});

void test('stops following redirects after a few, and does not follow one to another protocol', async (): Promise<void> => {
  assert.equal(await local.download(`${base}/loop`), null);
  assert.equal(await local.download(`${base}/to-file`), null);
  assert.equal(await local.download('not an address'), null);
});

void test('by default reaches only the open internet over HTTPS: not this machine, not plain HTTP', async (): Promise<void> => {
  const guarded = new HttpImageDownloaderAdapter();

  assert.equal(await guarded.download(`${base}/ok.png`), null);
  await assert.rejects(guarded.download(`https://localhost:${new URL(base).port}/ok.png`));
});
