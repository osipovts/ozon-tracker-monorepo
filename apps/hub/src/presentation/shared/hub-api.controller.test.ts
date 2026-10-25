import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { silentLogger } from 'logger';
import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { GetJobUseCase } from '../../application/job/get-job.use-case.js';
import type { JobQueuePort } from '../../application/job/job-queue.port.js';
import { ListJobsUseCase } from '../../application/job/list-jobs.use-case.js';
import { RecordJobEventUseCase } from '../../application/job/record-job-event.use-case.js';
import { AddProductUseCase } from '../../application/product/add-product.use-case.js';
import { ListPriceHistoryUseCase } from '../../application/product/list-price-history.use-case.js';
import { ListProductsUseCase } from '../../application/product/list-products.use-case.js';
import { RequestPriceObservationUseCase } from '../../application/product/request-price-observation.use-case.js';
import { ListProxiesUseCase } from '../../application/proxy/list-proxies.use-case.js';
import { RefreshProxySourceUseCase } from '../../application/proxy/refresh-proxy-source.use-case.js';
import { DeleteSessionUseCase } from '../../application/session/delete-session.use-case.js';
import { ImportSessionUseCase } from '../../application/session/import-session.use-case.js';
import { ListSessionsUseCase } from '../../application/session/list-sessions.use-case.js';
import { LOGGER } from '../../application/shared/logger.port.js';
import { ProxyEntity } from '../../domain/proxy/proxy.entity.js';
import { InMemoryJobRepositoryAdapter } from '../../infrastructure/job/in-memory-job-repository.adapter.js';
import { InMemoryPriceObservationRepositoryAdapter } from '../../infrastructure/product/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../../infrastructure/product/in-memory-tracked-product-repository.adapter.js';
import { InMemoryProxyRepositoryAdapter } from '../../infrastructure/proxy/in-memory-proxy-repository.adapter.js';
import { InMemoryBrowserSessionRepositoryAdapter } from '../../infrastructure/session/in-memory-browser-session-repository.adapter.js';
import { JobsController } from '../job/jobs.controller.js';
import { ProductsController } from '../product/products.controller.js';
import { ProxiesController } from '../proxy/proxies.controller.js';
import { ProxySourcesController } from '../proxy/proxy-sources.controller.js';
import { SessionsController } from '../session/sessions.controller.js';
import { ApplicationErrorFilter } from './application-error.filter.js';
import { HttpLoggingInterceptor } from './http-logging.interceptor.js';

const proxies = new InMemoryProxyRepositoryAdapter();
const products = new InMemoryTrackedProductRepositoryAdapter();
const observations = new InMemoryPriceObservationRepositoryAdapter();
const jobs = new InMemoryJobRepositoryAdapter();
const sessions = new InMemoryBrowserSessionRepositoryAdapter();

const queued: unknown[] = [];
const queue: JobQueuePort = {
  enqueueProxyFetch: (request): Promise<void> => {
    queued.push(request);

    return Promise.resolve();
  },
  enqueuePriceFetch: (request): Promise<void> => {
    queued.push(request);

    return Promise.resolve();
  },
};

let app: INestApplication;
let baseUrl: string;

before(async (): Promise<void> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [
      ProxiesController,
      ProxySourcesController,
      ProductsController,
      JobsController,
      SessionsController,
    ],
    providers: [
      { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
      { provide: APP_FILTER, useClass: ApplicationErrorFilter },
      { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
      { provide: LOGGER, useValue: silentLogger },
      { provide: GetJobUseCase, useValue: new GetJobUseCase(jobs) },
      { provide: ListJobsUseCase, useValue: new ListJobsUseCase(jobs) },
      { provide: ImportSessionUseCase, useValue: new ImportSessionUseCase(sessions) },
      { provide: ListSessionsUseCase, useValue: new ListSessionsUseCase(sessions) },
      { provide: DeleteSessionUseCase, useValue: new DeleteSessionUseCase(sessions) },
      { provide: RefreshProxySourceUseCase, useValue: new RefreshProxySourceUseCase(queue, jobs) },
      { provide: ListProxiesUseCase, useValue: new ListProxiesUseCase(proxies, sessions) },
      {
        provide: AddProductUseCase,
        useValue: new AddProductUseCase(
          new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
          products,
        ),
      },
      { provide: ListProductsUseCase, useValue: new ListProductsUseCase(products, observations) },
      {
        provide: RequestPriceObservationUseCase,
        useValue: new RequestPriceObservationUseCase(products, proxies, sessions, queue, jobs, {
          proxyCount: 3,
          timeoutMs: 30000,
        }),
      },
      {
        provide: ListPriceHistoryUseCase,
        useValue: new ListPriceHistoryUseCase(products, observations),
      },
    ],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
});

after(async (): Promise<void> => {
  await app.close();
});

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body: unknown = await response.json();
  assert.ok(typeof body === 'object' && body !== null);

  return { status: response.status, body: Object.fromEntries(Object.entries(body)) };
}

function post(body?: unknown): RequestInit {
  return {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  };
}

const productUrl = 'https://www.ozon.ru/product/4775581891/';

async function addProduct(): Promise<string> {
  const added = await call('/products', post({ url: productUrl }));
  assert.ok(added.status === 201 || added.status === 200);

  return String(added.body['id']);
}

void test('adds a product without proxies but refuses to read its price', async (): Promise<void> => {
  const id = await addProduct();

  const response = await call(`/products/${id}/prices`, post());

  assert.equal(response.status, 409);
  assert.equal(queued.length, 0);
});

void test('queues a proxy source refresh with defaults, with and without a body', async (): Promise<void> => {
  const withoutBody = await call('/proxy-sources/github-free-proxy-list/refresh', post());
  assert.equal(withoutBody.status, 202);
  assert.equal(typeof withoutBody.body['jobId'], 'string');

  const withBody = await call(
    '/proxy-sources/github-free-proxy-list/refresh',
    post({ maxCandidates: 10 }),
  );
  assert.equal(withBody.status, 202);
  assert.deepEqual(
    queued.slice(-2).map((request) => request),
    [expectRequest(withoutBody.body['jobId'], 200), expectRequest(withBody.body['jobId'], 10)],
  );

  assert.equal((await call('/proxy-sources/unknown/refresh', post())).status, 400);
  assert.equal(
    (await call('/proxy-sources/github-free-proxy-list/refresh', post({ maxCandidates: 0 })))
      .status,
    400,
  );
});

function expectRequest(jobId: unknown, maxCandidates: number): unknown {
  return {
    jobId,
    source: 'github-free-proxy-list',
    maxCandidates,
    probeTimeoutMs: 10000,
  };
}

void test('lists proxies with pagination and validates the query', async (): Promise<void> => {
  await proxies.saveMany(
    [1, 2, 3].map(
      (index) =>
        new ProxyEntity({
          server: `socks5://217.71.230.${String(index)}:1080`,
          source: 'github-free-proxy-list',
          country: 'RU',
          exitIp: null,
          alive: index !== 3,
          latencyMs: 100 * index,
          checksTotal: 1,
          checksAlive: index !== 3 ? 1 : 0,
          lastCheckedAt: new Date('2026-10-24T12:00:00.000Z'),
        }),
    ),
  );

  const alive = await call('/proxies?pageSize=1');
  assert.equal(alive.status, 200);
  assert.equal(alive.body['total'], 2);
  assert.equal(alive.body['pageSize'], 1);
  assert.deepEqual(alive.body['items'], [
    {
      server: 'socks5://217.71.230.1:1080',
      source: 'github-free-proxy-list',
      country: 'RU',
      exitIp: null,
      alive: true,
      latencyMs: 100,
      successRate: 1,
      checksTotal: 1,
      lastCheckedAt: '2026-10-24T12:00:00.000Z',
      ready: false,
      session: null,
    },
  ]);

  assert.equal((await call('/proxies?alive=false')).body['total'], 1);
  assert.equal((await call('/proxies?country=US')).body['total'], 0);
  assert.equal((await call('/proxies?pageSize=1000')).status, 400);
  assert.equal((await call('/proxies?country=ru')).status, 400);
});

void test('tracks a product once whatever the link and lists it with its newest price', async (): Promise<void> => {
  const first = await call(
    '/products',
    post({ url: 'https://www.ozon.ru/product/asus-4775581891/?sh=share' }),
  );
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, {
    id: first.body['id'],
    marketplace: 'ozon',
    externalId: '4775581891',
    url: productUrl,
    lastStatus: null,
    lastCheckedAt: null,
  });

  const created = await call('/products', post({ url: 'https://ozon.ru/product/1/' }));
  assert.equal(created.status, 201);

  const list = await call('/products?pageSize=10');
  assert.equal(list.status, 200);
  assert.equal(list.body['total'], 2);

  const items: unknown = list.body['items'];
  assert.ok(Array.isArray(items));
  // The newest product comes first; nothing has been read yet.
  assert.deepEqual(
    items.map((item: unknown): unknown =>
      typeof item === 'object' && item !== null && 'url' in item && 'latest' in item
        ? [item.url, item.latest]
        : item,
    ),
    [
      ['https://www.ozon.ru/product/1/', null],
      [productUrl, null],
    ],
  );
});

void test('queues a read of the fresh price and serves an empty history meanwhile', async (): Promise<void> => {
  const id = await addProduct();
  const requested = await call(`/products/${id}/prices`, post());
  assert.equal(requested.status, 202);
  assert.deepEqual(queued.at(-1), {
    jobId: requested.body['jobId'],
    routes: [
      { server: 'socks5://217.71.230.1:1080', session: null },
      { server: 'socks5://217.71.230.2:1080', session: null },
    ],
    products: [{ trackedProductId: id, url: productUrl }],
    timeoutMs: 30000,
  });

  const history = await call(`/products/${id}/prices`);
  assert.equal(history.status, 200);
  assert.deepEqual(history.body, {
    product: {
      id,
      marketplace: 'ozon',
      externalId: '4775581891',
      url: productUrl,
      lastStatus: null,
      lastCheckedAt: null,
    },
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
  });
});

void test('rejects bad links, unknown and malformed product ids', async (): Promise<void> => {
  assert.equal((await call('/products', post({ url: 'not a url' }))).status, 400);
  assert.equal((await call('/products', post({ url: 'https://example.com/item/1' }))).status, 400);
  assert.equal((await call('/products/nope/prices')).status, 400);
  const unknown = '/products/9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33/prices';
  assert.equal((await call(unknown)).status, 404);
  assert.equal((await call(unknown, post())).status, 404);
});

void test('documents the endpoints and their zod schemas in Swagger', (): void => {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Hub').build());
  assert.deepEqual(Object.keys(document.paths).toSorted(), [
    '/jobs',
    '/jobs/{id}',
    '/products',
    '/products/{id}/prices',
    '/proxies',
    '/proxy-sources/{source}/refresh',
    '/sessions',
    '/sessions/{id}',
  ]);

  assert.ok(document.paths['/sessions']?.post?.requestBody);
  assert.ok(document.paths['/jobs/{id}']?.get?.responses['200']);

  const prices = document.paths['/products/{id}/prices']?.get;
  assert.deepEqual(
    prices?.parameters
      ?.map((parameter) => ('name' in parameter ? parameter.name : '$ref'))
      .toSorted(),
    ['id', 'page', 'pageSize'],
  );

  const proxiesGet = document.paths['/proxies']?.get;
  assert.deepEqual(
    proxiesGet?.parameters
      ?.map((parameter) => ('name' in parameter ? parameter.name : '$ref'))
      .toSorted(),
    ['alive', 'country', 'marketplace', 'page', 'pageSize', 'ready'],
  );
  assert.ok(proxiesGet.responses['200']);

  const add = document.paths['/products']?.post;
  assert.deepEqual(Object.keys(add?.responses ?? {}).toSorted(), ['200', '201', '400']);
  assert.ok(add?.requestBody);
  assert.ok(document.paths['/products']?.get?.responses['200']);
  assert.ok(document.paths['/products/{id}/prices']?.post?.responses['202']);
});

const sessionFile = {
  marketplace: 'ozon',
  proxy: 'socks5://217.71.230.9:1080',
  session: {
    id: '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22',
    exitIp: '217.71.230.9',
    userAgent: 'Mozilla/5.0',
    storageState: {
      cookies: [
        {
          name: 'abt',
          value: 'secret',
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
  },
  createdAt: '2026-10-24T12:00:00.000Z',
};

void test('imports, lists and deletes a session without exposing its cookies', async (): Promise<void> => {
  const imported = await call('/sessions', post(sessionFile));
  assert.equal(imported.status, 201);
  assert.equal(imported.body['status'], 'active');
  assert.equal(imported.body['cookies'], 1);
  assert.equal(JSON.stringify(imported.body).includes('secret'), false);

  const list = await call('/sessions');
  assert.equal(list.body['total'], 1);
  assert.equal(JSON.stringify(list.body).includes('secret'), false);
  assert.equal((await call('/sessions', post({ ...sessionFile, marketplace: 'x' }))).status, 400);

  const id = sessionFile.session.id;
  assert.equal((await fetch(`${baseUrl}/sessions/${id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/sessions/${id}`, { method: 'DELETE' })).status, 404);
});

void test('the queued session goes to the worker first, then the job reports its progress', async (): Promise<void> => {
  await call('/sessions', post(sessionFile));
  const productId = await addProduct();
  const queuedProduct = await call(`/products/${productId}/prices`, post());
  assert.equal(queuedProduct.status, 202);

  const request = queued.at(-1);
  assert.ok(typeof request === 'object' && request !== null && 'routes' in request);
  assert.ok(Array.isArray(request.routes));
  assert.deepEqual(request.routes[0], {
    server: sessionFile.proxy,
    session: { ...sessionFile.session },
  });

  const jobId = String(queuedProduct.body['jobId']);
  const queuedJob = await call(`/jobs/${jobId}`);
  assert.equal(queuedJob.status, 200);
  assert.equal(queuedJob.body['status'], 'queued');
  assert.equal(queuedJob.body['percent'], 0);
  assert.equal(queuedJob.body['kind'], 'price_fetch');
  assert.equal(queuedJob.body['subject'], productId);

  const events = new RecordJobEventUseCase(jobs);
  await events.execute({
    type: 'progress',
    jobId,
    at: new Date(),
    progress: { processed: 1, total: 1, succeeded: 1 },
  });
  await events.execute({ type: 'completed', jobId, at: new Date() });

  const done = await call(`/jobs/${jobId}`);
  assert.equal(done.body['status'], 'completed');
  assert.equal(done.body['percent'], 100);
  assert.equal(typeof done.body['finishedAt'], 'string');

  const listed = await call('/jobs?kind=price_fetch&status=completed');
  assert.equal(listed.body['total'], 1);
  assert.equal((await call('/jobs?status=unknown')).status, 400);
  assert.equal((await call('/jobs/9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33')).status, 404);
});

void test('a proxy becomes ready once it has an active session', async (): Promise<void> => {
  const server = 'socks5://217.71.230.1:1080';
  const id = '1c7f2a90-34b1-4c4f-8f55-5a5f6f1e2e44';

  const before = await call('/proxies?ready=false');
  assert.ok(Array.isArray(before.body['items']));
  assert.ok(JSON.stringify(before.body['items']).includes(server));

  const imported = await call(
    '/sessions',
    post({
      ...sessionFile,
      proxy: server,
      session: { ...sessionFile.session, id, exitIp: '217.71.230.1' },
    }),
  );
  assert.equal(imported.status, 201);

  const notReady = await call('/proxies?ready=false');
  assert.equal(JSON.stringify(notReady.body['items']).includes(server), false);
  const ready = await call('/proxies?ready=true');
  assert.equal(ready.body['total'], 1);

  const items: unknown = ready.body['items'];
  assert.ok(Array.isArray(items));
  const item: unknown = items[0];
  assert.ok(typeof item === 'object' && item !== null);
  assert.equal('ready' in item && item.ready, true);
  assert.equal('session' in item && JSON.stringify(item.session).includes(id), true);
  assert.equal((await call('/proxies?marketplace=unknown')).status, 400);
});
