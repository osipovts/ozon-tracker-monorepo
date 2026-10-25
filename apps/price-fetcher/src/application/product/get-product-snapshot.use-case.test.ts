import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProductReferenceEntity } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import { GetProductSnapshotUseCase } from './get-product-snapshot.use-case.js';

const reference = new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/');

void test('stops at a challenge instead of rotating proxies or claiming out-of-stock', async (): Promise<void> => {
  let calls = 0;
  const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
  const useCase = new GetProductSnapshotUseCase({
    read: (): Promise<ReadProductResultType> => {
      calls += 1;

      return Promise.resolve({ status: 'challenge_required' });
    },
  });

  const result = await useCase.execute(reference, [proxy, proxy], new AbortController().signal);

  assert.equal(calls, 1);
  assert.equal(result.status, 'challenge_required');
});

void test('a null route makes a direct attempt', async (): Promise<void> => {
  const useCase = new GetProductSnapshotUseCase({
    read: (
      _reference: ProductReferenceEntity,
      endpoint: ProxyEndpointEntity | null,
    ): Promise<ReadProductResultType> => {
      assert.equal(endpoint, null);

      return Promise.resolve({ status: 'network_error' });
    },
  });

  const result = await useCase.execute(reference, [null], new AbortController().signal);

  assert.deepEqual(result.attempts, [{ proxy: null, result: { status: 'network_error' } }]);
  assert.equal(result.status, 'network_error');
});

void test('reports no proxies without routes', async (): Promise<void> => {
  const useCase = new GetProductSnapshotUseCase({
    read: (): Promise<ReadProductResultType> => {
      throw new Error('Must not read');
    },
  });

  const result = await useCase.execute(reference, [], new AbortController().signal);

  assert.deepEqual(result, { status: 'no_proxies', attempts: [] });
});
