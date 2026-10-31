import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  JobQueuePort,
  PriceFetchRequestInterface,
} from '../../job/application/job-queue.port.js';
import { ScheduleJobUseCase } from '../../job/application/schedule-job.use-case.js';
import { InMemoryJobRepositoryAdapter } from '../../job/infrastructure/in-memory-job-repository.adapter.js';
import type { ClockPort } from '../../shared/application/clock.port.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import type { ChoosePriceRoutesUseCase } from './choose-price-routes.use-case.js';
import { RefreshPricesUseCase } from './refresh-prices.use-case.js';

const hour = 3_600_000;
const start = new Date('2026-10-31T10:00:00Z');
const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const route = { server: 'socks5://217.71.230.1:1080', session: null };

interface SetupInterface {
  refresh: RefreshPricesUseCase;
  products: InMemoryTrackedProductRepositoryAdapter;
  jobs: InMemoryJobRepositoryAdapter;
  requests: PriceFetchRequestInterface[];
  at: (hours: number) => void;
  queue: { failing: boolean };
}

function setup(
  routes: Array<typeof route> = [route],
  batchSize = 200,
  age: { maxAgeMs: number; periodMs: number } = { maxAgeMs: 6 * hour, periodMs: 15 * 60_000 },
): SetupInterface {
  let current = start;
  const clock: ClockPort = { now: (): Date => current };
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const jobs = new InMemoryJobRepositoryAdapter();
  const requests: PriceFetchRequestInterface[] = [];
  const queue = { failing: false };
  const port: JobQueuePort = {
    enqueueProxyFetch: (): Promise<void> => Promise.resolve(),
    enqueueHandbookFetch: (): Promise<void> => Promise.resolve(),
    enqueuePriceFetch: (request): Promise<void> => {
      if (queue.failing) return Promise.reject(new Error('redis is down'));
      requests.push(request);

      return Promise.resolve();
    },
  };
  const chooseRoutes: Pick<ChoosePriceRoutesUseCase, 'execute'> = {
    execute: (): Promise<Array<typeof route>> => Promise.resolve(routes),
  };

  return {
    refresh: new RefreshPricesUseCase(
      products,
      chooseRoutes,
      new ScheduleJobUseCase(port, jobs),
      { ...age, batchSize, timeoutMs: 30_000 },
      clock,
    ),
    products,
    jobs,
    requests,
    at: (hours): void => {
      current = new Date(start.getTime() + hours * hour);
    },
    queue,
  };
}

async function track(
  products: InMemoryTrackedProductRepositoryAdapter,
  n: number,
  userId: string | null = jane,
): Promise<string> {
  const { product } = await products.add({
    marketplace: 'ozon',
    externalId: String(n),
    url: `https://www.ozon.ru/product/${String(n)}/`,
    cityId: null,
    cityName: null,
  });
  if (userId !== null) await products.subscribe(userId, product.snapshot.id);

  return product.snapshot.id;
}

void test("queues the read of the products nobody has read yet, in one job, and records the job as the hub's own", async (): Promise<void> => {
  const { refresh, products, jobs, requests } = setup();
  const [first, second] = [await track(products, 1), await track(products, 2)];

  const result = await refresh.execute();

  assert.deepEqual(result, { products: 2, jobs: 1 });
  assert.equal(requests.length, 1);
  const [request] = requests;
  assert.ok(request);
  assert.deepEqual(
    request.products.map((product): string => product.trackedProductId).toSorted(),
    [first, second].toSorted(),
  );
  assert.deepEqual(request.routes, [route]);
  const { items } = await jobs.list({ kind: 'price_fetch' }, { page: 1, pageSize: 10 });
  assert.equal(items.length, 1);
  const [job] = items;
  assert.ok(job);
  assert.equal(job.snapshot.requestedBy, null);
  assert.equal(job.snapshot.total, 2);
});

void test('does not queue a product again while its job may still be on its way, nor one nobody tracks', async (): Promise<void> => {
  const { refresh, products, requests, at } = setup();
  await track(products, 1);
  await track(products, 2, null);

  await refresh.execute();
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.products.length, 1);

  at(1);
  assert.deepEqual(await refresh.execute(), { products: 0, jobs: 0 });
  assert.equal(requests.length, 1);
});

void test('queues a product again once its last read or request is older than the maximum age', async (): Promise<void> => {
  const { refresh, products, requests, at } = setup();
  const id = await track(products, 1);
  await refresh.execute();

  at(7);
  await refresh.execute();

  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.products[0]?.trackedProductId, id);

  // A read that came back (even a failed one) counts as fresh as well.
  await products.markChecked(id, 'ok', new Date(start.getTime() + 12 * hour));
  at(13);
  assert.deepEqual(await refresh.execute(), { products: 0, jobs: 0 });
});

void test('with a maximum age as long as the period every run reads every price, and none twice in one', async (): Promise<void> => {
  const { refresh, products, requests, at } = setup([route], 200, {
    maxAgeMs: hour,
    periodMs: hour,
  });
  const id = await track(products, 1);

  await refresh.execute();
  assert.equal(requests.length, 1);

  // A run is an hour after the last, and the price was read at the end of that one: it is 59 minutes old.
  at(1);
  await products.markChecked(id, 'ok', new Date(start.getTime() + 59 * 60_000));
  await refresh.execute();
  assert.equal(requests.length, 2);

  // The same run again reads nothing: the request of a moment ago is not older than the run.
  assert.deepEqual(await refresh.execute(), { products: 0, jobs: 0 });
});

void test('waits for a route instead of queueing a job that cannot run: the products stay due', async (): Promise<void> => {
  const { refresh, products, requests, jobs } = setup([]);
  await track(products, 1);

  assert.deepEqual(await refresh.execute(), { products: 0, jobs: 0 });
  assert.equal(requests.length, 0);
  assert.equal((await jobs.list({}, { page: 1, pageSize: 10 })).total, 0);
});

void test('splits a long list into jobs the worker takes, and reads no more than the batch of one run', async (): Promise<void> => {
  const { refresh, products, requests } = setup([route], 120);
  for (let n = 1; n <= 150; n += 1) await track(products, n);

  const result = await refresh.execute();

  assert.deepEqual(result, { products: 120, jobs: 3 });
  assert.deepEqual(
    requests.map((request): number => request.products.length),
    [50, 50, 20],
  );

  assert.deepEqual(await refresh.execute(), { products: 30, jobs: 1 });
});

void test('a job the queue refuses leaves its products due for the next run, and does not stop the others', async (): Promise<void> => {
  const { refresh, products, requests, queue } = setup();
  await track(products, 1);

  queue.failing = true;
  assert.deepEqual(await refresh.execute(), { products: 0, jobs: 0 });

  queue.failing = false;
  assert.deepEqual(await refresh.execute(), { products: 1, jobs: 1 });
  assert.equal(requests.length, 1);
});

void test('names the city of a product in the job of the schedule', async (): Promise<void> => {
  const { refresh, products, requests } = setup();
  const cityId = '30b7c1f1-03fb-11dc-95ee-00151716f9f5';
  const { product } = await products.add({
    marketplace: 'dns',
    externalId: '0463bb2411a1d582',
    url: 'https://www.dns-shop.ru/product/0463bb2411a1d582/',
    cityId,
    cityName: 'Иркутск',
  });
  await products.subscribe(jane, product.snapshot.id);

  await refresh.execute();

  assert.deepEqual(requests[0]?.products, [
    { trackedProductId: product.snapshot.id, url: product.snapshot.url, cityId },
  ]);
});
