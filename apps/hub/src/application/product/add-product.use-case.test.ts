import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { InMemoryPriceObservationRepositoryAdapter } from '../../infrastructure/product/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../../infrastructure/product/in-memory-tracked-product-repository.adapter.js';
import { AddProductUseCase } from './add-product.use-case.js';
import { ListProductsUseCase } from './list-products.use-case.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

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

void test('tracks a product once whatever the link to it', async (): Promise<void> => {
  const { add } = setup();
  const first = await add.execute('https://www.ozon.ru/product/asus-4775581891/?sh=share');
  assert.equal(first.created, true);
  assert.equal(first.product.url, 'https://www.ozon.ru/product/4775581891/');
  assert.equal(first.product.externalId, '4775581891');
  const second = await add.execute('https://ozon.ru/product/4775581891/');
  assert.equal(second.created, false);
  assert.equal(second.product.id, first.product.id);
  await assert.rejects(add.execute('https://example.com/item/1'), UnsupportedProductUrlError);
});

void test('lists products, the newest first, with their newest observation', async (): Promise<void> => {
  const { add, products, observations } = setup();
  const older = (await add.execute('https://www.ozon.ru/product/1/')).product;
  const newer = (await add.execute('https://www.ozon.ru/product/2/')).product;
  for (const [day, amountMinor] of [
    [22, 100],
    [24, 300],
    [23, 200],
  ] as const) {
    await observations.saveIfAbsent({
      id: `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${String(day)}`,
      trackedProductId: older.id,
      jobId: `3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a${String(day)}`,
      status: 'success',
      title: 'Notebook',
      observedAt: new Date(Date.UTC(2026, 9, day)),
      availability: 'in_stock',
      prices: [{ amountMinor, currency: 'RUB' }],
      exitIp: null,
    });
  }
  const page = await new ListProductsUseCase(products, observations).execute({
    page: 1,
    pageSize: 10,
  });
  assert.equal(page.total, 2);
  assert.deepEqual(
    page.items.map((item): [string, number | undefined] => [
      item.product.id,
      item.latest?.prices[0]?.amountMinor,
    ]),
    [
      [newer.id, undefined],
      [older.id, 300],
    ],
  );
});
