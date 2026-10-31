import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DnsReferenceParser } from './dns-reference.parser.js';

const parser = new DnsReferenceParser();

void test('canonicalizes the link of a product, with or without its name', (): void => {
  for (const input of [
    'https://www.dns-shop.ru/product/0463bb2411a1d582/156-noutbuk-asus-vivobook-s-15-oled-s5507qa-ma076w-serebristyj/',
    'https://dns-shop.ru/product/0463bb2411a1d582/',
    'https://www.dns-shop.ru/product/0463BB2411A1D582/?utm_source=share',
  ]) {
    const reference = parser.parse(new URL(input));

    assert.equal(reference?.marketplace, 'dns');
    assert.equal(reference.id, '0463bb2411a1d582');
    assert.equal(reference.url, 'https://www.dns-shop.ru/product/0463bb2411a1d582/');
    assert.equal(reference.cityId, null);
  }
});

void test('takes the link of the analogs of a product for the product itself', (): void => {
  const reference = parser.parse(
    new URL(
      'https://www.dns-shop.ru/product/analog/b8541ae3b40bd2fe/16-noutbuk-asus-zenbook-a16-ux3607oa-sq013w-bezevyj/',
    ),
  );

  assert.equal(reference?.id, 'b8541ae3b40bd2fe');
  assert.equal(reference.url, 'https://www.dns-shop.ru/product/b8541ae3b40bd2fe/');
});

void test('rejects foreign hosts, credentials, ports, other paths and ids of another shape', (): void => {
  for (const input of [
    'http://www.dns-shop.ru/product/0463bb2411a1d582/',
    'https://dns-shop.ru.evil.test/product/0463bb2411a1d582/',
    'https://dns-shop.ru@evil.test/product/0463bb2411a1d582/',
    'https://www.dns-shop.ru:8080/product/0463bb2411a1d582/',
    'https://www.dns-shop.ru/catalog/17a892f816404e77/noutbuki/',
    'https://www.dns-shop.ru/product/12345/',
    'https://www.dns-shop.ru/product/0463bb2411a1d582zz/',
  ]) {
    assert.equal(parser.parse(new URL(input)), null, input);
  }
});
