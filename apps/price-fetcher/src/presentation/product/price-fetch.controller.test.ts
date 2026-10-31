import assert from 'node:assert/strict';
import { test } from 'node:test';

import { silentLogger } from 'logger';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';
import type { PriceFetchResultType } from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser } from 'queue-worker';

import { FetchPricesUseCase } from '../../application/product/fetch-prices.use-case.js';
import type { ProductReaderPort } from '../../application/product/product-reader.port.js';
import type { ReadProductResultType } from '../../domain/product/product-snapshot.interface.js';
import { PriceFetchController } from './price-fetch.controller.js';

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const productId = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const invalidProductId = '1c7f2a90-34b1-4c4f-8f55-5a5f6f1e2e44';
const job = {
  jobId,
  proxies: [{ server: 'socks5://217.71.230.103:1080' }, { server: 'socks5://127.0.0.1:1080' }],
  products: [
    { trackedProductId: productId, url: 'https://www.ozon.ru/product/4775581891/' },
    { trackedProductId: invalidProductId, url: 'https://example.com/item/1' },
  ],
  timeoutMs: 15000,
};
const success: ReadProductResultType = {
  status: 'success',
  snapshot: {
    title: 'Notebook',
    observedAt: '2026-10-24T12:00:00.000Z',
    prices: [{ amountMinor: 10000000, currency: 'RUB' }],
    availability: 'in_stock',
    imageUrl: null,
  },
  exitIp: '217.71.230.103',
};

function createController(published: PriceFetchResultType[]): PriceFetchController {
  const publish = (message: PriceFetchResultType): Promise<void> => {
    published.push(message);

    return Promise.resolve();
  };

  return new PriceFetchController(
    new FetchPricesUseCase(
      new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
      (): ProductReaderPort => ({
        read: (): Promise<ReadProductResultType> => Promise.resolve(success),
      }),
    ),
    new QueueMessageParser(silentLogger),
    new JobLifecycleReporter(publish, silentLogger),
    publish,
  );
}

function isType<TypeName extends PriceFetchResultType['type']>(
  type: TypeName,
): (message: PriceFetchResultType) => message is Extract<PriceFetchResultType, { type: TypeName }> {
  return (message): message is Extract<PriceFetchResultType, { type: TypeName }> =>
    message.type === type;
}

void test('reads products through the given routes and reports progress and completion', async (): Promise<void> => {
  const published: PriceFetchResultType[] = [];
  await createController(published).handle(job, new AbortController().signal);

  assert.deepEqual(
    published.map((message): string => message.type),
    [
      'job_started',
      'job_progress',
      'product_result',
      'job_progress',
      'product_result',
      'job_progress',
      'job_done',
    ],
  );
  assert.deepEqual(
    published
      .filter(isType('job_progress'))
      .map((progress): number[] => [progress.processed, progress.total, progress.succeeded]),
    [
      [0, 2, 0],
      [1, 2, 1],
      [2, 2, 1],
    ],
  );

  const [first, second] = published.filter(isType('product_result'));
  assert.deepEqual(first, {
    type: 'product_result',
    jobId,
    trackedProductId: productId,
    status: 'success',
    attempts: [{ proxy: 'socks5://217.71.230.103:1080', result: success }],
  });
  assert.equal(second?.status, 'invalid_url');
});

void test('reports no proxies when every route is unsafe', async (): Promise<void> => {
  const published: PriceFetchResultType[] = [];
  await createController(published).handle(
    {
      ...job,
      proxies: [{ server: 'socks5://127.0.0.1:1080' }],
      products: [job.products[0]],
    },
    new AbortController().signal,
  );

  const [first] = published.filter(isType('product_result'));
  assert.equal(first?.status, 'no_proxies');
});

void test('reports a failed job and tells whether it is retried', async (): Promise<void> => {
  const published: PriceFetchResultType[] = [];
  const abort = new AbortController();
  abort.abort();

  await assert.rejects(createController(published).handle(job, abort.signal, true));

  const [failure] = published.filter(isType('job_failed'));
  assert.equal(failure?.willRetry, true);
  assert.equal(published.some(isType('job_done')), false);
});

void test('rejects a malformed job', async (): Promise<void> => {
  await assert.rejects(
    createController([]).handle({ jobId: 'nope' }, new AbortController().signal),
    { name: 'UnrecoverableError' },
  );
});
