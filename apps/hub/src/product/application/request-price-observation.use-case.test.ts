import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ListMarketplaceSessionsUseCase } from '../../browser-session/application/index.js';
import { BrowserSessionEntity } from '../../browser-session/domain/browser-session.entity.js';
import { InMemoryBrowserSessionRepositoryAdapter } from '../../browser-session/infrastructure/in-memory-browser-session-repository.adapter.js';
import { ScheduleJobUseCase } from '../../job/application/index.js';
import type {
  JobQueuePort,
  PriceFetchRequestInterface,
} from '../../job/application/job-queue.port.js';
import { InMemoryJobRepositoryAdapter } from '../../job/infrastructure/in-memory-job-repository.adapter.js';
import { ListBestProxyServersUseCase } from '../../proxy/application/index.js';
import { ProxyEntity } from '../../proxy/domain/proxy.entity.js';
import { InMemoryProxyRepositoryAdapter } from '../../proxy/infrastructure/in-memory-proxy-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { ChoosePriceRoutesUseCase } from './choose-price-routes.use-case.js';
import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import { RequestPriceObservationUseCase } from './request-price-observation.use-case.js';

function proxy(server: string, alive: boolean, checksAlive: number): ProxyEntity {
  return new ProxyEntity({
    server,
    source: 'github-free-proxy-list',
    country: 'RU',
    exitIp: null,
    alive,
    latencyMs: 200,
    checksTotal: 4,
    checksAlive,
    lastCheckedAt: new Date('2026-10-24T12:00:00.000Z'),
    disabledAt: null,
  });
}

function session(proxyServer: string | null, status: 'active' | 'stale'): BrowserSessionEntity {
  return new BrowserSessionEntity({
    id:
      proxyServer === null
        ? '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22'
        : '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
    marketplace: 'ozon',
    proxyServer,
    exitIp: '217.71.230.103',
    userAgent: 'Mozilla/5.0',
    storageState: { cookies: [], origins: [] },
    status,
    staleReason: status === 'stale' ? 'challenge_required' : null,
    createdAt: new Date('2026-10-24T12:00:00.000Z'),
    updatedAt: new Date('2026-10-24T12:00:00.000Z'),
    lastUsedAt: null,
  });
}

const productUrl = 'https://www.ozon.ru/product/4775581891/';
const userId = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';

async function createUseCase(
  proxies: ProxyEntity[],
  sessions: BrowserSessionEntity[] = [],
  failQueue = false,
): Promise<{
  useCase: RequestPriceObservationUseCase;
  requests: PriceFetchRequestInterface[];
  jobs: InMemoryJobRepositoryAdapter;
  productId: string;
}> {
  const repository = new InMemoryProxyRepositoryAdapter();
  await repository.saveMany(proxies);

  const sessionRepository = new InMemoryBrowserSessionRepositoryAdapter();
  for (const item of sessions) await sessionRepository.save(item);

  const products = new InMemoryTrackedProductRepositoryAdapter();
  const { product } = await products.add({
    marketplace: 'ozon',
    externalId: '4775581891',
    url: productUrl,
  });
  await products.subscribe(userId, product.snapshot.id);

  const jobs = new InMemoryJobRepositoryAdapter();
  const requests: PriceFetchRequestInterface[] = [];
  const queue: JobQueuePort = {
    enqueueProxyFetch: (): Promise<void> => Promise.resolve(),
    enqueuePriceFetch: (request): Promise<void> => {
      if (failQueue) return Promise.reject(new Error('redis is down'));
      requests.push(request);

      return Promise.resolve();
    },
  };

  return {
    useCase: new RequestPriceObservationUseCase(
      products,
      new ChoosePriceRoutesUseCase(
        new ListBestProxyServersUseCase(repository),
        new ListMarketplaceSessionsUseCase(sessionRepository),
        2,
      ),
      new ScheduleJobUseCase(queue, jobs),
      30000,
    ),
    requests,
    jobs,
    productId: product.snapshot.id,
  };
}

void test('queues the product with the best alive proxies and records the job', async (): Promise<void> => {
  const { useCase, requests, jobs, productId } = await createUseCase([
    proxy('socks5://217.71.230.1:1080', true, 2),
    proxy('socks5://217.71.230.2:1080', true, 4),
    proxy('socks5://217.71.230.3:1080', true, 3),
    proxy('socks5://217.71.230.4:1080', false, 4),
  ]);

  const { jobId } = await useCase.execute(userId, productId);

  const request = requests[0];
  assert.ok(request);
  assert.equal(request.jobId, jobId);
  assert.deepEqual(request.routes, [
    { server: 'socks5://217.71.230.2:1080', session: null },
    { server: 'socks5://217.71.230.3:1080', session: null },
  ]);
  assert.deepEqual(request.products, [{ trackedProductId: productId, url: productUrl }]);
  assert.equal(request.timeoutMs, 30000);

  const job = await jobs.findById(jobId);
  assert.equal(job?.snapshot.status, 'queued');
  assert.equal(job.snapshot.kind, 'price_fetch');
  assert.equal(job.snapshot.subject, productId);
  assert.equal(job.snapshot.total, 1);
});

void test('puts routes with an active session first and skips the stale ones', async (): Promise<void> => {
  const pinned = 'socks5://217.71.230.2:1080';
  const { useCase, requests, productId } = await createUseCase(
    [
      proxy('socks5://217.71.230.1:1080', true, 4),
      proxy(pinned, true, 3),
      proxy('socks5://217.71.230.3:1080', true, 2),
    ],
    [session(pinned, 'active'), session(null, 'stale')],
  );

  await useCase.execute(userId, productId);

  const routes = requests[0]?.routes ?? [];
  assert.deepEqual(
    routes.map((route): string | null => route.server),
    [pinned, 'socks5://217.71.230.1:1080'],
  );
  assert.equal(routes[0]?.session?.id, '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11');
  assert.equal(routes[1]?.session, null);
});

void test('works with a session only, even without alive proxies', async (): Promise<void> => {
  const { useCase, requests, productId } = await createUseCase([], [session(null, 'active')]);

  await useCase.execute(userId, productId);

  assert.deepEqual(
    requests[0]?.routes.map((route): string | null => route.server),
    [null],
  );
});

void test('refuses a product the user does not track, though it exists', async (): Promise<void> => {
  const { useCase, requests, productId } = await createUseCase([
    proxy('socks5://217.71.230.1:1080', true, 4),
  ]);

  await assert.rejects(
    useCase.execute('9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33', productId),
    ProductNotFoundError,
  );
  assert.equal(requests.length, 0);
});

void test('refuses an unknown product and a missing route without queueing', async (): Promise<void> => {
  const empty = await createUseCase([proxy('socks5://217.71.230.1:1080', false, 0)]);

  await assert.rejects(empty.useCase.execute(userId, empty.productId), NoProxiesAvailableError);
  await assert.rejects(
    empty.useCase.execute(userId, '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33'),
    ProductNotFoundError,
  );

  assert.equal(empty.requests.length, 0);
  assert.equal((await empty.jobs.list({}, { page: 1, pageSize: 10 })).total, 0);
});

void test('marks the job failed if it cannot be queued', async (): Promise<void> => {
  const { useCase, jobs, productId } = await createUseCase(
    [proxy('socks5://217.71.230.1:1080', true, 1)],
    [],
    true,
  );

  await assert.rejects(useCase.execute(userId, productId), /redis is down/);
  const [job] = (await jobs.list({}, { page: 1, pageSize: 10 })).items;
  assert.equal(job?.snapshot.status, 'failed');
});
