import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DnsReferenceParser, ProductReferenceEntity } from 'product-reference';

import type { DnsPageInterface } from './dns-page.interface.js';
import { DnsProductParser } from './dns-product.parser.js';

const reference = new ProductReferenceEntity(
  'dns',
  '0463bb2411a1d582',
  'https://www.dns-shop.ru/product/0463bb2411a1d582/',
);
const parser = new DnsProductParser(new DnsReferenceParser());
const base: DnsPageInterface = {
  url: 'https://www.dns-shop.ru/product/0463bb2411a1d582/156-noutbuk-asus-vivobook-serebristyj/',
  heading: '15.6" Ноутбук ASUS Vivobook S 15 Oled серебристый',
  priceText: '152 999 ₽',
  hasBuyButton: true,
  hasNotifyButton: false,
  imageUrl: 'https://c.dns-shop.ru/thumb/st1/fit/300/300/0e68/fe2a.jpg',
};

void test('reads the price and the title of a product that is in stock', (): void => {
  const snapshot = parser.parse(reference, base);

  assert.ok(snapshot);
  assert.equal(snapshot.title, '15.6" Ноутбук ASUS Vivobook S 15 Oled серебристый');
  assert.deepEqual(snapshot.prices, [{ amountMinor: 15299900, currency: 'RUB' }]);
  assert.equal(snapshot.availability, 'in_stock');
  assert.equal(snapshot.imageUrl, 'https://c.dns-shop.ru/thumb/st1/fit/300/300/0e68/fe2a.jpg');
});

void test('a product with the button to be told of its arrival is out of stock, and keeps its price', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    priceText: '204 999 ₽',
    hasBuyButton: false,
    hasNotifyButton: true,
  });

  assert.ok(snapshot);
  assert.equal(snapshot.availability, 'out_of_stock');
  assert.deepEqual(snapshot.prices, [{ amountMinor: 20499900, currency: 'RUB' }]);
});

void test('without either button the availability is not known', (): void => {
  const snapshot = parser.parse(reference, { ...base, hasBuyButton: false });

  assert.equal(snapshot?.availability, 'unknown');
});

void test('takes the page of the analogs of the product for the product, and no other page', (): void => {
  const analogs = 'https://www.dns-shop.ru/product/analog/0463bb2411a1d582/156-noutbuk/';
  const other = 'https://www.dns-shop.ru/product/b8541ae3b40bd2fe/16-noutbuk/';

  assert.ok(parser.parse(reference, { ...base, url: analogs }));
  assert.equal(parser.parse(reference, { ...base, url: other }), null);
  assert.equal(parser.parse(reference, { ...base, url: 'https://www.dns-shop.ru/' }), null);
});

void test('a page without a title, or without any price, is not a card of a product', (): void => {
  assert.equal(parser.parse(reference, { ...base, heading: '' }), null);
  assert.equal(parser.parse(reference, { ...base, priceText: '' }), null);
  assert.equal(parser.parse(reference, { ...base, priceText: 'нет цены' }), null);
});

void test('takes the picture only if a browser can load its address', (): void => {
  assert.equal(parser.parse(reference, { ...base, imageUrl: '' })?.imageUrl, null);
  assert.equal(
    parser.parse(reference, { ...base, imageUrl: 'javascript:alert(1)' })?.imageUrl,
    null,
  );
  assert.equal(parser.parse(reference, { ...base, imageUrl: '/relative.jpg' })?.imageUrl, null);
});
