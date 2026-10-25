import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser } from './ozon-reference.parser.js';

const parser = new OzonReferenceParser();

void test('canonicalizes the provided kind of shared product link', (): void => {
  const reference = parser.parse(
    new URL('https://www.ozon.ru/product/asus-zenbook-4775581891/?at=tracking&sh=share'),
  );

  assert.equal(reference?.marketplace, 'ozon');
  assert.equal(reference.id, '4775581891');
  assert.equal(reference.url, 'https://www.ozon.ru/product/4775581891/');
});

void test('rejects foreign hosts, credentials, ports and non-product URLs', (): void => {
  for (const input of [
    'http://www.ozon.ru/product/1/',
    'https://ozon.ru.evil.test/product/1/',
    'https://ozon.ru@evil.test/product/1/',
    'https://ozon.ru:8080/product/1/',
    'https://ozon.ru/category/1/',
  ]) {
    assert.equal(parser.parse(new URL(input)), null);
  }
});
