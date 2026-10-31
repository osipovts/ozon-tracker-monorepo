import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { after, before, test } from 'node:test';

import { DnsCitiesByLetterSourceAdapter } from './dns-cities-by-letter-source.adapter.js';

const requests: IncomingMessage[] = [];
let answer: { status: number; body: string } = { status: 200, body: '' };
let server: Server;
let baseUrl: string;

before(async (): Promise<void> => {
  server = createServer((request, response): void => {
    requests.push(request);
    response.writeHead(answer.status, { 'content-type': 'application/json' });
    response.end(answer.body);
  });
  await new Promise<void>((resolve): void => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${String(address.port)}`;
});

after((): void => {
  server.close();
});

const signal = new AbortController().signal;

void test('asks for the cities of a letter as the site does, and maps them', async (): Promise<void> => {
  answer = {
    status: 200,
    body: JSON.stringify({
      message: '',
      data: {
        cities: [
          {
            id: '30b7c1f1-03fb-11dc-95ee-00151716f9f5',
            name: 'Иркутск',
            regionName: 'Иркутская область',
            citySlug: 'irkutsk',
            shopUrl: '/shops/irkutsk/',
          },
          { id: 'b', name: ' Ивангород ', regionName: '', citySlug: 'x', shopUrl: '/' },
        ],
      },
    }),
  };

  const cities = await new DnsCitiesByLetterSourceAdapter(baseUrl).read('И', null, signal);

  assert.deepEqual(cities, [
    { id: '30b7c1f1-03fb-11dc-95ee-00151716f9f5', name: 'Иркутск', region: 'Иркутская область' },
    { id: 'b', name: 'Ивангород', region: null },
  ]);
  const request = requests.at(-1);
  assert.equal(request?.url, `/v1/site/get-cities-by-letter?letter=${encodeURIComponent('И')}`);
  assert.equal(request.headers.origin, 'https://www.dns-shop.ru');
  assert.equal(request.headers.referer, 'https://www.dns-shop.ru/');
});

void test('rejects an answer that is not the list of cities, or not a success', async (): Promise<void> => {
  const adapter = new DnsCitiesByLetterSourceAdapter(baseUrl);

  for (const next of [
    { status: 401, body: '{}' },
    { status: 200, body: 'not json' },
    { status: 200, body: JSON.stringify({ data: { cities: [{ name: 'no id' }] } }) },
    { status: 200, body: JSON.stringify({ data: {} }) },
  ]) {
    answer = next;
    await assert.rejects(adapter.read('А', null, signal));
  }
});

void test('rejects when the signal is aborted', async (): Promise<void> => {
  answer = { status: 200, body: JSON.stringify({ data: { cities: [] } }) };

  await assert.rejects(
    new DnsCitiesByLetterSourceAdapter(baseUrl).read('А', null, AbortSignal.abort()),
  );
});
