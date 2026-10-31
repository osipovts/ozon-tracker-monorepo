import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { GetProductStatsUseCase } from './get-product-stats.use-case.js';

void test('counts the products and the trackings: users share products', async (): Promise<void> => {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const reference = (
    n: number,
  ): {
    marketplace: 'ozon';
    externalId: string;
    url: string;
    cityId: null;
    cityName: null;
  } => ({
    marketplace: 'ozon',
    externalId: String(n),
    url: `https://www.ozon.ru/product/${String(n)}/`,
    cityId: null,
    cityName: null,
  });
  const [first, second] = [await products.add(reference(1)), await products.add(reference(2))];
  await products.subscribe('jane', first.product.snapshot.id);
  await products.subscribe('sam', first.product.snapshot.id);
  await products.subscribe('sam', second.product.snapshot.id);

  assert.deepEqual(await new GetProductStatsUseCase(products).execute(), {
    products: 2,
    trackings: 3,
  });
});
