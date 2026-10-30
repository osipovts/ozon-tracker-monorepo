import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryJobRepositoryAdapter } from '../infrastructure/in-memory-job-repository.adapter.js';
import type {
  JobQueuePort,
  PriceFetchRequestInterface,
  ProxyFetchRequestInterface,
} from './job-queue.port.js';
import { ScheduleJobUseCase } from './schedule-job.use-case.js';

const productId = '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11';

function setup(failQueue = false): {
  useCase: ScheduleJobUseCase;
  jobs: InMemoryJobRepositoryAdapter;
  proxyRequests: ProxyFetchRequestInterface[];
  priceRequests: PriceFetchRequestInterface[];
} {
  const jobs = new InMemoryJobRepositoryAdapter();
  const proxyRequests: ProxyFetchRequestInterface[] = [];
  const priceRequests: PriceFetchRequestInterface[] = [];
  const queue: JobQueuePort = {
    enqueueProxyFetch: (request): Promise<void> => {
      if (failQueue) return Promise.reject(new Error('redis is down'));
      proxyRequests.push(request);

      return Promise.resolve();
    },
    enqueuePriceFetch: (request): Promise<void> => {
      if (failQueue) return Promise.reject(new Error('redis is down'));
      priceRequests.push(request);

      return Promise.resolve();
    },
  };

  return { useCase: new ScheduleJobUseCase(queue, jobs), jobs, proxyRequests, priceRequests };
}

void test('records a queued proxy job and publishes it under the same id', async (): Promise<void> => {
  const { useCase, jobs, proxyRequests } = setup();

  const { jobId } = await useCase.execute({
    kind: 'proxy_fetch',
    source: 'github-free-proxy-list',
    maxCandidates: 50,
    probeTimeoutMs: 5000,
  });

  assert.deepEqual(proxyRequests, [
    { jobId, source: 'github-free-proxy-list', maxCandidates: 50, probeTimeoutMs: 5000 },
  ]);
  const job = await jobs.findById(jobId);
  assert.ok(job);
  assert.equal(job.snapshot.kind, 'proxy_fetch');
  assert.equal(job.snapshot.subject, 'github-free-proxy-list');
  assert.equal(job.snapshot.status, 'queued');
  assert.equal(job.snapshot.total, null);
});

void test('records a queued price job for the product and publishes its routes', async (): Promise<void> => {
  const { useCase, jobs, priceRequests } = setup();
  const routes = [{ server: 'socks5://217.71.230.1:1080', session: null }];
  const products = [{ trackedProductId: productId, url: 'https://www.ozon.ru/product/1/' }];

  const { jobId } = await useCase.execute({
    kind: 'price_fetch',
    productId,
    routes,
    products,
    timeoutMs: 30000,
  });

  assert.deepEqual(priceRequests, [{ jobId, routes, products, timeoutMs: 30000 }]);
  const job = await jobs.findById(jobId);
  assert.ok(job);
  assert.equal(job.snapshot.kind, 'price_fetch');
  assert.equal(job.snapshot.subject, productId);
  assert.equal(job.snapshot.total, 1);
});

void test('fails the recorded job for good when the queue is down', async (): Promise<void> => {
  const { useCase, jobs } = setup(true);

  await assert.rejects(
    useCase.execute({
      kind: 'proxy_fetch',
      source: 'github-free-proxy-list',
      maxCandidates: 50,
      probeTimeoutMs: 5000,
    }),
    /redis is down/,
  );

  const { items } = await jobs.list({}, { page: 1, pageSize: 10 });
  assert.equal(items.length, 1);
  assert.equal(items[0]?.snapshot.status, 'failed');
  assert.equal(items[0].snapshot.error, 'Could not be queued');
});
