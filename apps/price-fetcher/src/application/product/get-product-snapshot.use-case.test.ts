import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProductReferenceEntity } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import { GetProductSnapshotUseCase } from './get-product-snapshot.use-case.js';

void test('stops at a challenge instead of rotating proxies or claiming out-of-stock', async (): Promise<void> => {
  let calls = 0;
  const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
  const useCase = new GetProductSnapshotUseCase(
    { getCandidates: (): Promise<ProxyEndpointEntity[]> => Promise.resolve([proxy, proxy]) },
    {
      read: (): Promise<ReadProductResultType> => {
        calls += 1;
        return Promise.resolve({ status: 'challenge_required' });
      },
    },
  );
  const result = await useCase.execute(
    new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/'),
    new AbortController().signal,
  );
  assert.equal(calls, 1);
  assert.equal(result.status, 'challenge_required');
});

void test('uses an explicit proxy without downloading a public list', async (): Promise<void> => {
  const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
  const useCase = new GetProductSnapshotUseCase(
    {
      getCandidates: (): Promise<ProxyEndpointEntity[]> => {
        throw new Error('Must not fetch');
      },
    },
    {
      read: (): Promise<ReadProductResultType> => Promise.resolve({ status: 'proxy_rejected' }),
    },
  );
  const result = await useCase.execute(
    new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/'),
    new AbortController().signal,
    proxy,
  );
  assert.equal(result.status, 'proxy_rejected');
  assert.equal(result.attempts.length, 1);
});

void test('direct mode makes one attempt without requesting a proxy list', async (): Promise<void> => {
  const useCase = new GetProductSnapshotUseCase(
    {
      getCandidates: (): Promise<ProxyEndpointEntity[]> => {
        throw new Error('Must not fetch');
      },
    },
    {
      read: (
        _reference: ProductReferenceEntity,
        endpoint: ProxyEndpointEntity | null,
      ): Promise<ReadProductResultType> => {
        assert.equal(endpoint, null);
        return Promise.resolve({ status: 'network_error' });
      },
    },
  );
  const result = await useCase.execute(
    new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/'),
    new AbortController().signal,
    null,
  );
  assert.deepEqual(result.attempts, [{ proxy: null, result: { status: 'network_error' } }]);
  assert.equal(result.status, 'network_error');
});
