import assert from 'node:assert/strict';
import { test } from 'node:test';

import { UnrecoverableError } from 'bullmq';
import { silentLogger } from 'logger';
import { QueueMessageParser } from 'queue-worker';

import { ImportSessionUseCase } from '../../browser-session/application/import-session.use-case.js';
import { RecordSessionEventUseCase } from '../../browser-session/application/record-session-event.use-case.js';
import { InMemoryBrowserSessionRepositoryAdapter } from '../../browser-session/infrastructure/in-memory-browser-session-repository.adapter.js';
import { RecordJobEventUseCase } from '../../job/application/record-job-event.use-case.js';
import { RecordJobMessageUseCase } from '../../job/application/record-job-message.use-case.js';
import { InMemoryJobRepositoryAdapter } from '../../job/infrastructure/in-memory-job-repository.adapter.js';
import type { AppConfigInterface } from '../../shared/application/app-config.interface.js';
import { ListPriceHistoryUseCase } from '../application/list-price-history.use-case.js';
import { RecordPriceResultUseCase } from '../application/record-price-result.use-case.js';
import { InMemoryPriceObservationRepositoryAdapter } from '../infrastructure/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { PriceResultsConsumer } from './price-results.consumer.js';

const config: AppConfigInterface = {
  databaseUrl: 'postgresql://localhost:5432/hub',
  redisUrl: 'redis://localhost:6379',
  port: 3000,
  priceProxyCount: 5,
  priceTimeoutMs: 60000,
  priceRefreshIntervalMs: 0,
  priceRefreshMaxAgeMs: 21_600_000,
  priceRefreshBatchSize: 200,
  authSessionIdleTtlMs: 60_000,
  authSessionAbsoluteTtlMs: 120_000,
  smtpUrl: null,
  mailFrom: 'hub@example.com',
  emailVerificationTtlMs: 86_400_000,
  authVerificationResendMaxAttempts: 1000,
  productsPerUserMax: 100,
  productAddMaxAttempts: 1000,
  productAddWindowMs: 60_000,
  authSessionPurgeIntervalMs: 60_000,
  authRateLimitWindowMs: 60_000,
  authLoginMaxAttempts: 1000,
  authLoginMaxAttemptsPerEmail: 1000,
  authLoginMaxAttemptsPerIp: 1000,
  authRegisterMaxAttempts: 1000,
  trustProxy: 0,
  publicUrl: 'http://localhost:3000',
  authAllowedOrigins: [],
  authSuccessRedirect: '/auth/me',
  googleOauth: null,
  githubOauth: null,
  operatorApiKey: null,
  authCookieSecure: false,
  logLevel: 'error',
};

const jobId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';
const sessionId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

const userId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

async function setup(): Promise<{
  consumer: PriceResultsConsumer;
  history: ListPriceHistoryUseCase;
  sessions: InMemoryBrowserSessionRepositoryAdapter;
  productId: string;
}> {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const observations = new InMemoryPriceObservationRepositoryAdapter();
  const { product } = await products.add({
    marketplace: 'ozon',
    externalId: '4775581891',
    url: 'https://www.ozon.ru/product/4775581891/',
  });
  await products.subscribe(userId, product.snapshot.id);

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
      new RecordJobMessageUseCase(new RecordJobEventUseCase(new InMemoryJobRepositoryAdapter())),
      new RecordSessionEventUseCase(sessions),
      new QueueMessageParser(silentLogger),
      config,
      silentLogger,
    ),
    history: new ListPriceHistoryUseCase(products, observations),
    sessions,
    productId: product.snapshot.id,
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

  const [observation] = (await history.execute(userId, productId, { page: 1, pageSize: 10 })).page
    .items;
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
