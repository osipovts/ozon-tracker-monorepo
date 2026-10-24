import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { MarketplaceReferenceParserPort } from './marketplace-reference-parser.port.js';
import { ProductReferenceEntity } from './product-reference.entity.js';
import { ResolveProductReferenceUseCase } from './resolve-product-reference.use-case.js';

const ozonParser: MarketplaceReferenceParserPort = {
  marketplace: 'ozon',
  parse: (url: URL): ProductReferenceEntity | null =>
    url.hostname === 'www.ozon.ru'
      ? new ProductReferenceEntity('ozon', '1', 'https://www.ozon.ru/product/1/')
      : null,
};

void test('returns the reference from the first parser that recognizes the link', (): void => {
  const reference = new ResolveProductReferenceUseCase([ozonParser]).execute(
    'https://www.ozon.ru/product/1/',
  );
  assert.equal(reference.marketplace, 'ozon');
  assert.equal(reference.id, '1');
});

void test('rejects malformed and unsupported links', (): void => {
  const useCase = new ResolveProductReferenceUseCase([ozonParser]);
  assert.throws((): ProductReferenceEntity => useCase.execute('not a url'));
  assert.throws((): ProductReferenceEntity => useCase.execute('https://example.com/product/1/'));
});
