import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { InMemoryPriceObservationRepositoryAdapter } from '../infrastructure/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { AddProductUseCase } from './add-product.use-case.js';
import { ListPriceHistoryUseCase } from './list-price-history.use-case.js';
import { ListProductsUseCase } from './list-products.use-case.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';

function setup(): {
  add: AddProductUseCase;
  products: InMemoryTrackedProductRepositoryAdapter;
  observations: InMemoryPriceObservationRepositoryAdapter;
} {
  const products = new InMemoryTrackedProductRepositoryAdapter();

  return {
    add: new AddProductUseCase(
      new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
      products,
    ),
    products,
    observations: new InMemoryPriceObservationRepositoryAdapter(),
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
