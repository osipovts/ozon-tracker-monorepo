import assert from 'node:assert/strict';
import { test } from 'node:test';

import { InMemoryObjectStorageAdapter } from '../../shared/infrastructure/in-memory-object-storage.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { RemoveProductUseCase } from './remove-product.use-case.js';
import { RemoveUserProductsUseCase } from './remove-user-products.use-case.js';

void test('stops tracking every product of the user, deleting those nobody else tracks, even past one page', async (): Promise<void> => {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const storage = new InMemoryObjectStorageAdapter();
  const ids: string[] = [];
  for (let n = 1; n <= 130; n += 1) {
    const { product } = await products.add({
      marketplace: 'ozon',
      externalId: String(n),
      url: `https://www.ozon.ru/product/${String(n)}/`,
      cityId: null,
      cityName: null,
    });
    await products.subscribe('jane', product.snapshot.id);
    ids.push(product.snapshot.id);
  }
  // The first of them is Sam's as well, and stays.
  await products.subscribe('sam', ids[0] ?? '');

  await new RemoveUserProductsUseCase(
    products,
    new RemoveProductUseCase(products, storage),
  ).execute('jane');

  assert.equal((await products.listSubscribed('jane', { page: 1, pageSize: 10 })).total, 0);
  assert.notEqual(await products.findById(ids[0] ?? ''), null);
  assert.equal((await products.listSubscribed('sam', { page: 1, pageSize: 10 })).total, 1);
  for (const id of ids.slice(1)) assert.equal(await products.findById(id), null);
});
