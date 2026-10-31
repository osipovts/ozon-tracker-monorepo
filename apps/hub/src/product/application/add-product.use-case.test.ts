import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import { InMemoryRateLimiterAdapter } from '../../shared/infrastructure/in-memory-rate-limiter.adapter.js';
import { InMemoryPriceObservationRepositoryAdapter } from '../infrastructure/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { AddProductUseCase } from './add-product.use-case.js';
import { ListPriceHistoryUseCase } from './list-price-history.use-case.js';
import { ListProductsUseCase } from './list-products.use-case.js';
import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import type { ProductLimitsInterface } from './product-quota.type.js';
import { ProductQuotaExceededError } from './product-quota-exceeded.error.js';
import type { RequestPriceObservationUseCase } from './request-price-observation.use-case.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const roomy: ProductLimitsInterface = { maxProducts: 100, add: { limit: 100, windowMs: 60_000 } };

interface PriceReadInterface {
  userId: string;
  productId: string;
}

/** Counts the products registered, to tell a product refused before it was created from one created and left. */
class CountingProducts extends InMemoryTrackedProductRepositoryAdapter {
  added = 0;

  override add(
    ...args: Parameters<InMemoryTrackedProductRepositoryAdapter['add']>
  ): ReturnType<InMemoryTrackedProductRepositoryAdapter['add']> {
    this.added += 1;

    return super.add(...args);
  }
}

function setup(
  limits: ProductLimitsInterface = roomy,
  request: Pick<RequestPriceObservationUseCase, 'execute'> | null = null,
  products: InMemoryTrackedProductRepositoryAdapter = new InMemoryTrackedProductRepositoryAdapter(),
): {
  add: AddProductUseCase;
  products: InMemoryTrackedProductRepositoryAdapter;
  observations: InMemoryPriceObservationRepositoryAdapter;
  reads: PriceReadInterface[];
} {
  const observations = new InMemoryPriceObservationRepositoryAdapter();
  const reads: PriceReadInterface[] = [];
  const reading: Pick<RequestPriceObservationUseCase, 'execute'> = request ?? {
    execute: (userId, productId): Promise<{ jobId: string }> => {
      reads.push({ userId, productId });

      return Promise.resolve({ jobId: `job-${String(reads.length)}` });
    },
  };

  return {
    add: new AddProductUseCase(
      new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
      products,
      observations,
      reading,
      new InMemoryRateLimiterAdapter(),
      limits,
    ),
    products,
    observations,
    reads,
  };
}

void test('tracks a product once per user whatever the link to it', async (): Promise<void> => {
  const { add } = setup();

  const first = await add.execute(jane, 'https://www.ozon.ru/product/asus-4775581891/?sh=share');
  assert.equal(first.created, true);
  assert.equal(first.product.snapshot.url, 'https://www.ozon.ru/product/4775581891/');
  assert.equal(first.product.snapshot.externalId, '4775581891');

  const second = await add.execute(jane, 'https://ozon.ru/product/4775581891/');
  assert.equal(second.created, false);
  assert.equal(second.product.snapshot.id, first.product.snapshot.id);
  await assert.rejects(add.execute(jane, 'https://example.com/item/1'), UnsupportedProductUrlError);
});

void test('users share a product and its price history: the second one joins the first', async (): Promise<void> => {
  const { add } = setup();

  const first = await add.execute(jane, 'https://www.ozon.ru/product/4775581891/');
  const joined = await add.execute(sam, 'https://www.ozon.ru/product/4775581891/');

  assert.equal(joined.created, true);
  assert.equal(joined.product.snapshot.id, first.product.snapshot.id);
});

void test('queues the read of the first price when the product has none, and says which job it is', async (): Promise<void> => {
  const { add, reads } = setup();

  const added = await add.execute(jane, 'https://www.ozon.ru/product/1/');

  assert.equal(added.jobId, 'job-1');
  assert.deepEqual(reads, [{ userId: jane, productId: added.product.snapshot.id }]);
});

void test('queues no read when a user adds a product they track already', async (): Promise<void> => {
  const { add, reads } = setup();
  await add.execute(jane, 'https://www.ozon.ru/product/1/');

  const again = await add.execute(jane, 'https://www.ozon.ru/product/1/');

  assert.equal(again.created, false);
  assert.equal(again.jobId, null);
  assert.equal(reads.length, 1);
});

void test('reads no price again for a product that has one: the others added it before', async (): Promise<void> => {
  const { add, observations, reads } = setup();
  const { product } = await add.execute(jane, 'https://www.ozon.ru/product/1/');
  await observations.saveIfAbsent({
    id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a22',
    trackedProductId: product.snapshot.id,
    jobId: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a23',
    title: 'Notebook',
    observedAt: new Date(),
    availability: 'in_stock',
    prices: [{ amountMinor: 100, currency: 'RUB' }],
    exitIp: null,
  });
  reads.length = 0;

  const joined = await add.execute(sam, 'https://www.ozon.ru/product/1/');

  assert.equal(joined.created, true);
  assert.equal(joined.jobId, null);
  assert.equal(reads.length, 0);
});

void test('tracks the product all the same when its price cannot be read now', async (): Promise<void> => {
  const { add, products } = setup(roomy, {
    execute: (): Promise<{ jobId: string }> => Promise.reject(new NoProxiesAvailableError()),
  });

  const added = await add.execute(jane, 'https://www.ozon.ru/product/1/');
  assert.equal(added.created, true);
  assert.equal(added.jobId, null);
  assert.notEqual(await products.findSubscribed(jane, added.product.snapshot.id), null);

  const outage = setup(roomy, {
    execute: (): Promise<{ jobId: string }> => Promise.reject(new Error('redis is down')),
  });
  assert.equal((await outage.add.execute(jane, 'https://www.ozon.ru/product/1/')).jobId, null);
});

void test('lets a user track so many products, and takes no more, nor creates a product for nothing', async (): Promise<void> => {
  const counting = new CountingProducts();
  const { add } = setup({ maxProducts: 2, add: { limit: 100, windowMs: 60_000 } }, null, counting);
  await add.execute(jane, 'https://www.ozon.ru/product/1/');
  await add.execute(jane, 'https://www.ozon.ru/product/2/');

  await assert.rejects(
    add.execute(jane, 'https://www.ozon.ru/product/3/'),
    ProductQuotaExceededError,
  );

  assert.equal(counting.added, 2);
  // Another user is not held by the quota of this one.
  await add.execute(sam, 'https://www.ozon.ru/product/3/');
  assert.equal(counting.added, 3);
});

void test('lets a user add so fast, and stops one who adds faster, whatever the products', async (): Promise<void> => {
  const { add } = setup({ maxProducts: 100, add: { limit: 2, windowMs: 60_000 } });

  await add.execute(jane, 'https://www.ozon.ru/product/1/');
  await add.execute(jane, 'https://www.ozon.ru/product/1/');
  await assert.rejects(add.execute(jane, 'https://www.ozon.ru/product/2/'), TooManyRequestsError);

  await add.execute(sam, 'https://www.ozon.ru/product/2/');
});

void test('lists the products of the user, the newest first, with their newest observation', async (): Promise<void> => {
  const { add, products, observations } = setup();

  const older = (await add.execute(jane, 'https://www.ozon.ru/product/1/')).product;
  const newer = (await add.execute(jane, 'https://www.ozon.ru/product/2/')).product;
  await add.execute(sam, 'https://www.ozon.ru/product/3/');
  for (const [day, amountMinor] of [
    [22, 100],
    [24, 300],
    [23, 200],
  ] as const) {
    await observations.saveIfAbsent({
      id: `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${String(day)}`,
      trackedProductId: older.snapshot.id,
      jobId: `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${String(day)}`,
      title: 'Notebook',
      observedAt: new Date(Date.UTC(2026, 9, day)),
      availability: 'in_stock',
      prices: [{ amountMinor, currency: 'RUB' }],
      exitIp: null,
    });
  }

  const page = await new ListProductsUseCase(products, observations).execute(jane, {
    page: 1,
    pageSize: 10,
  });

  assert.equal(page.total, 2);
  assert.deepEqual(
    page.items.map((item): [string, number | undefined] => [
      item.product.snapshot.id,
      item.latest?.prices[0]?.amountMinor,
    ]),
    [
      [newer.snapshot.id, undefined],
      [older.snapshot.id, 300],
    ],
  );
});

void test('the history of a product is for those who track it: to the others it does not exist', async (): Promise<void> => {
  const { add, products, observations } = setup();
  const { product } = await add.execute(jane, 'https://www.ozon.ru/product/1/');
  const history = new ListPriceHistoryUseCase(products, observations);

  const own = await history.execute(jane, product.snapshot.id, { page: 1, pageSize: 10 });
  assert.equal(own.product.snapshot.id, product.snapshot.id);

  await assert.rejects(
    history.execute(sam, product.snapshot.id, { page: 1, pageSize: 10 }),
    ProductNotFoundError,
  );
});
