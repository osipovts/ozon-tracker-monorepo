import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProductReferenceEntity } from 'product-reference';

import type { ReadProductResultType } from '../domain/product-snapshot.interface.js';
import { MarketplaceProductReaderAdapter } from './marketplace-product-reader.adapter.js';

void test('delegates reading to the reader of the reference marketplace', async (): Promise<void> => {
  const reader = new MarketplaceProductReaderAdapter({
    ozon: {
      read: (): Promise<ReadProductResultType> => Promise.resolve({ status: 'parse_error' }),
    },
  });
  const result = await reader.read(
    new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/'),
    null,
    new AbortController().signal,
  );
  assert.equal(result.status, 'parse_error');
});
