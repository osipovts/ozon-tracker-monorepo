import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UnrecoverableError } from 'bullmq';
import { silentLogger } from 'logger';

import { RecordJobEventUseCase } from '../../application/job/record-job-event.use-case.js';
import { ListPriceHistoryUseCase } from '../../application/product/list-price-history.use-case.js';
import { RecordPriceResultUseCase } from '../../application/product/record-price-result.use-case.js';
import { ImportSessionUseCase } from '../../application/session/import-session.use-case.js';
import { RecordSessionEventUseCase } from '../../application/session/record-session-event.use-case.js';
import { InMemoryJobRepositoryAdapter } from '../../infrastructure/job/in-memory-job-repository.adapter.js';
import { InMemoryPriceObservationRepositoryAdapter } from '../../infrastructure/product/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../../infrastructure/product/in-memory-tracked-product-repository.adapter.js';
import { InMemoryBrowserSessionRepositoryAdapter } from '../../infrastructure/session/in-memory-browser-session-repository.adapter.js';
import type { AppConfigInterface } from '../../infrastructure/shared/app-config.interface.js';
import { PriceResultsConsumer } from './price-results.consumer.js';

const config: AppConfigInterface = {
  databaseUrl: 'postgresql://localhost:5432/hub',
  redisUrl: 'redis://localhost:6379',
  port: 3000,
  priceProxyCount: 5,
  priceTimeoutMs: 60000,
  logLevel: 'error',
};
const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const sessionId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

async function setup(): Promise<{
  consumer: PriceResultsConsumer;
  history: ListPriceHistoryUseCase;
  sessions: InMemoryBrowserSessionRepositoryAdapter;
  productId: string;
}> {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const observations = new InMemoryPriceObservationRepositoryAdapter();
  const product = await products.upsert({
    marketplace: 'ozon',
    externalId: '4775581891',
    url: 'https://www.ozon.ru/product/4775581891/',
  });
  const sessions = new InMemoryBrowserSessionRepositoryAdapter();
  await new ImportSessionUseCase(sessions).execute({
    id: sessionId,
    marketplace: 'ozon',
    proxyServer: 'socks5://217.71.230.2:1080',
    exitIp: '217.71.230.2',
    userAgent: 'Mozilla/5.0',
    storageState: { cookies: [], origins: [] },
    createdAt: new Date(),
  });
  return {
    consumer: new PriceResultsConsumer(
      new RecordPriceResultUseCase(products, observations),
      new RecordJobEventUseCase(new InMemoryJobRepositoryAdapter()),
      new RecordSessionEventUseCase(sessions),
      config,
      silentLogger,
    ),
    history: new ListPriceHistoryUseCase(products, observations),
    sessions,
    productId: product.id,
  };
}

void test('stores the snapshot of the attempt that read the product', async (): Promise<void> => {
  const { consumer, history, sessions, productId } = await setup();
  await consumer.handle({
    type: 'product_result',
    jobId,
    trackedProductId: productId,
    status: 'partial',
    attempts: [
      { proxy: 'socks5://217.71.230.1:1080', result: { status: 'network_error' } },
      {
        proxy: 'socks5://217.71.230.2:1080',
        sessionId,
        result: {
          status: 'partial',
          exitIp: '217.71.230.2',
          snapshot: {
            title: 'Notebook',
            observedAt: '2026-10-24T12:00:00.000Z',
            prices: [{ amountMinor: 18673000, currency: 'RUB' }],
            availability: 'in_stock',
          },
        },
      },
    ],
  });
  const [observation] = (await history.execute(productId, { page: 1, pageSize: 10 })).page.items;
  assert.equal(observation?.exitIp, '217.71.230.2');
  assert.equal(observation.prices[0]?.amountMinor, 18673000);
  assert.notEqual((await sessions.findById(sessionId))?.snapshot.lastUsedAt, null);
});

void test('marks a session stale after a challenge or an exit address mismatch', async (): Promise<void> => {
  const { consumer, sessions, productId } = await setup();
  await consumer.handle({
    type: 'product_result',
    jobId,
    trackedProductId: productId,
    status: 'challenge_required',
    attempts: [
      {
        proxy: 'socks5://217.71.230.2:1080',
        sessionId,
        result: { status: 'challenge_required' },
      },
    ],
  });
  assert.equal((await sessions.findById(sessionId))?.snapshot.staleReason, 'challenge_required');
  await consumer.handle({
    type: 'session_ip_mismatch',
    jobId,
    sessionId,
    expectedIp: '217.71.230.2',
    actualIp: '217.71.230.9',
  });
  assert.equal((await sessions.findById(sessionId))?.snapshot.staleReason, 'ip_mismatch');
});

void test('keeps the refreshed cookies of a session', async (): Promise<void> => {
  const { consumer, sessions } = await setup();
  await consumer.handle({
    type: 'session_update',
    jobId,
    sessionId,
    observedAt: '2026-10-24T12:00:00.000Z',
    storageState: {
      cookies: [
        {
          name: 'abt',
          value: 'v2',
          domain: '.ozon.ru',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  });
  assert.equal((await sessions.findById(sessionId))?.snapshot.storageState.cookies[0]?.value, 'v2');
});

void test('ignores session messages and rejects malformed ones for good', async (): Promise<void> => {
  const { consumer } = await setup();
  await consumer.handle({ type: 'job_done', jobId });
  await assert.rejects(consumer.handle({ type: 'product_result' }), UnrecoverableError);
});
