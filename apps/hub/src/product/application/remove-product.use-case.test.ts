import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ResolveProductReferenceUseCase } from 'product-reference';

import { InMemoryPriceObservationRepositoryAdapter } from '../infrastructure/in-memory-price-observation-repository.adapter.js';
import { InMemoryTrackedProductRepositoryAdapter } from '../infrastructure/in-memory-tracked-product-repository.adapter.js';
import { AddProductUseCase } from './add-product.use-case.js';
import { ListPriceHistoryUseCase } from './list-price-history.use-case.js';
import { ListProductsUseCase } from './list-products.use-case.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import { RemoveProductUseCase } from './remove-product.use-case.js';

const jane = '6b1f4d1e-52f2-4d51-8a0e-0d6a9d3a7c22';
const sam = '9a2d0f3c-0a44-4b6a-b8c2-7e7e2f3b1d33';
const url = 'https://www.ozon.ru/product/1/';
const firstPage = { page: 1, pageSize: 10 };

function setup(): {
  add: AddProductUseCase;
  remove: RemoveProductUseCase;
  list: ListProductsUseCase;
  history: ListPriceHistoryUseCase;
  products: InMemoryTrackedProductRepositoryAdapter;
} {
  const products = new InMemoryTrackedProductRepositoryAdapter();
  const observations = new InMemoryPriceObservationRepositoryAdapter();

  return {
    add: new AddProductUseCase(
      new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
      products,
    ),
    remove: new RemoveProductUseCase(products),
    list: new ListProductsUseCase(products, observations),
    history: new ListPriceHistoryUseCase(products, observations),
    products,
  };
}

void test('stops tracking for the user only while others still track the product', async (): Promise<void> => {
  const { add, remove, list, history, products } = setup();
  const { product } = await add.execute(jane, url);
  await add.execute(sam, url);

  await remove.execute(jane, product.snapshot.id);

  assert.equal((await list.execute(jane, firstPage)).total, 0);
  await assert.rejects(history.execute(jane, product.snapshot.id, firstPage), ProductNotFoundError);
  assert.equal((await list.execute(sam, firstPage)).total, 1);
  assert.notEqual(await products.findById(product.snapshot.id), null);
});

void test('deletes the product for good once nobody tracks it', async (): Promise<void> => {
  const { add, remove, products } = setup();
  const { product } = await add.execute(jane, url);
  await add.execute(sam, url);

  await remove.execute(jane, product.snapshot.id);
  await remove.execute(sam, product.snapshot.id);

  assert.equal(await products.findById(product.snapshot.id), null);
  const again = await add.execute(jane, url);
  assert.equal(again.created, true);
  assert.notEqual(again.product.snapshot.id, product.snapshot.id);
});

void test('refuses a product the user does not track, and a second removal', async (): Promise<void> => {
  const { add, remove } = setup();
  const { product } = await add.execute(jane, url);

  await assert.rejects(remove.execute(sam, product.snapshot.id), ProductNotFoundError);
  await remove.execute(jane, product.snapshot.id);
  await assert.rejects(remove.execute(jane, product.snapshot.id), ProductNotFoundError);
});
