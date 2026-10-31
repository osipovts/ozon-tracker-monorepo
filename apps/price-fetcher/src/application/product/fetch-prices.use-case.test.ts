import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import { InMemorySessionStoreAdapter } from '../../infrastructure/session/in-memory-session-store.adapter.js';
import {
  type FetchPricesListenerInterface,
  FetchPricesUseCase,
  type ProductFetchResultInterface,
} from './fetch-prices.use-case.js';
import type { ProductReaderPort } from './product-reader.port.js';

const trackedProductId = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const product = { trackedProductId, url: 'https://www.ozon.ru/product/1/' };
const proxy = 'socks5://217.71.230.103:1080';

async function fetchOne(
  servers: Array<string | null>,
  reader: ProductReaderPort,
): Promise<ProductFetchResultInterface | undefined> {
  const results: ProductFetchResultInterface[] = [];
  const listener: FetchPricesListenerInterface = {
    onProgress: (): Promise<void> => Promise.resolve(),
    onProduct: (result): Promise<void> => {
      results.push(result);

      return Promise.resolve();
    },
    onSessionUpdate: (): Promise<void> => Promise.resolve(),
    onSessionMismatch: (): Promise<void> => Promise.resolve(),
  };

  await new FetchPricesUseCase(
    new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
    (routes) => new InMemorySessionStoreAdapter(routes),
    (): ProductReaderPort => reader,
  ).execute(
    {
      routes: servers.map((server) => ({ server, session: null })),
      products: [product],
      timeoutMs: 1000,
    },
    new AbortController().signal,
    listener,
  );

  return results[0];
}

void test('stops at a challenge instead of rotating proxies or claiming out-of-stock', async (): Promise<void> => {
  let calls = 0;

  const result = await fetchOne([proxy, proxy], {
    read: (): Promise<ReadProductResultType> => {
      calls += 1;

      return Promise.resolve({ status: 'challenge_required' });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result?.status, 'challenge_required');
});

void test('a null route makes a direct attempt', async (): Promise<void> => {
  const result = await fetchOne([null], {
    read: (_reference, endpoint): Promise<ReadProductResultType> => {
      assert.equal(endpoint, null);

      return Promise.resolve({ status: 'network_error' });
    },
  });

  assert.deepEqual(result?.attempts, [{ proxy: null, result: { status: 'network_error' } }]);
});

void test('reports no proxies without routes', async (): Promise<void> => {
  const result = await fetchOne([], {
    read: (): Promise<ReadProductResultType> => {
      throw new Error('Must not read');
    },
  });

  assert.deepEqual(result, { trackedProductId, status: 'no_proxies', attempts: [] });
});
