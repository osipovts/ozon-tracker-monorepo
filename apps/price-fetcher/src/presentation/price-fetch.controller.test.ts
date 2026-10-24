import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ResolveProductReferenceUseCase } from 'product-reference';
import { OzonReferenceParser } from 'product-reference';
import type { PriceFetchResultType } from 'queue-contract';

import type { ProductReaderPort } from '../application/product-reader.port.js';
import type { SessionStorePort } from '../application/session-store.port.js';
import type { ReadProductResultType } from '../domain/product-snapshot.interface.js';
import { InvalidPriceFetchJobError, PriceFetchController } from './price-fetch.controller.js';

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const sessionId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const productId = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const invalidProductId = '1c7f2a90-34b1-4c4f-8f55-5a5f6f1e2e44';
const storageState = {
  cookies: [
    {
      name: 'abt',
      value: 'v1',
      domain: '.ozon.ru',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ],
  origins: [],
} as const;
const job = {
  jobId,
  proxies: [
    {
      server: 'socks5://217.71.230.103:1080',
      session: {
        id: sessionId,
        exitIp: '217.71.230.103',
        userAgent: 'Mozilla/5.0',
        platform: 'linux',
        browserVersion: '148.0.7778.96',
        storageState,
      },
    },
    { server: 'socks5://127.0.0.1:1080' },
  ],
  products: [
    { trackedProductId: productId, url: 'https://www.ozon.ru/product/4775581891/' },
    { trackedProductId: invalidProductId, url: 'https://example.com/item/1' },
  ],
  timeoutMs: 15000,
};
const success: ReadProductResultType = {
  status: 'success',
  snapshot: {
    productId: '4775581891',
    url: 'https://www.ozon.ru/product/4775581891/',
    title: 'Notebook',
    observedAt: '2026-10-24T12:00:00.000Z',
    deliveryContext: 'site_default',
    prices: [{ amountMinor: 10000000, currency: 'RUB' }],
    availability: 'in_stock',
  },
  exitIp: '217.71.230.103',
};

function createController(
  published: PriceFetchResultType[],
  environment = { platform: 'linux', browserVersion: '148.0.7778.96' },
): PriceFetchController {
  return new PriceFetchController(
    new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
    (sessions: SessionStorePort): ProductReaderPort => ({
      read: (_reference, proxy): Promise<ReadProductResultType> => {
        const session = sessions.find(proxy);
        if (session !== null)
          sessions.update(session.id, {
            cookies: [{ ...storageState.cookies[0], value: 'v2' }],
            origins: [],
          });
        return Promise.resolve(success);
      },
    }),
    environment,
    (message): Promise<void> => {
      published.push(message);
      return Promise.resolve();
    },
  );
}

function isType<TypeName extends PriceFetchResultType['type']>(
  type: TypeName,
): (message: PriceFetchResultType) => message is Extract<PriceFetchResultType, { type: TypeName }> {
  return (message): message is Extract<PriceFetchResultType, { type: TypeName }> =>
    message.type === type;
}

void test('reads products through the given routes and reports progress, sessions and completion', async (): Promise<void> => {
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
      'session_update',
      'job_done',
    ],
  );
  assert.deepEqual(
    published
      .filter(isType('job_progress'))
      .map((progress): number[] => [
        progress.percent,
        progress.processed,
        progress.total,
        progress.succeeded,
      ]),
    [
      [0, 0, 2, 0],
      [50, 1, 2, 1],
      [100, 2, 2, 1],
    ],
  );
  const [first, second] = published.filter(isType('product_result'));
  assert.deepEqual(first, {
    type: 'product_result',
    jobId,
    trackedProductId: productId,
    marketplace: 'ozon',
    externalId: '4775581891',
    status: 'success',
    attempts: [{ proxy: 'socks5://217.71.230.103:1080', sessionId, result: success }],
    warnings: [],
  });
  assert.equal(second?.status, 'invalid_url');
  const [update] = published.filter(isType('session_update'));
  assert.equal(update?.sessionId, sessionId);
  assert.equal(update.storageState.cookies[0]?.value, 'v2');
});

void test('warns when the session was created in another environment', async (): Promise<void> => {
  const published: PriceFetchResultType[] = [];
  await createController(published, { platform: 'darwin', browserVersion: '147.0.0.0' }).handle(
    job,
    new AbortController().signal,
  );
  const [first] = published.filter(isType('product_result'));
  assert.deepEqual(first?.warnings, ['platform_mismatch', 'browser_version_mismatch']);
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
    InvalidPriceFetchJobError,
  );
});
