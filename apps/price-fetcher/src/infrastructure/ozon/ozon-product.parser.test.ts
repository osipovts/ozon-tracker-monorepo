import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ProductReferenceEntity } from 'product-reference';

import type { OzonPageInterface } from './ozon-page.interface.js';
import { OzonProductParser } from './ozon-product.parser.js';

const reference = new ProductReferenceEntity(
  'ozon',
  '4775581891',
  'https://www.ozon.ru/product/4775581891/',
);
const parser = new OzonProductParser();
const base: OzonPageInterface = {
  title: 'Notebook',
  heading: 'Notebook',
  body: '',
  priceText: '',
  purchaseText: '',
  structuredData: [],
};

void test('reads the prices of the card and leaves customs payments out of them', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    priceText:
      '90\u202f000,50 ₽\nс Ozon Картой\n100 000 ₽\nбез Ozon Карты\nТаможенный платёж ~5 246 ₽',
    purchaseText: 'В корзину\nОсталось 3 штуки',
  });

  assert.ok(snapshot);
  assert.deepEqual(snapshot.prices, [
    { amountMinor: 9000050, currency: 'RUB' },
    { amountMinor: 10000000, currency: 'RUB' },
  ]);
  assert.equal(snapshot.availability, 'in_stock');
});

void test('ignores installments', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    priceText: '100 000 ₽\n5 000 ₽ в месяц',
    purchaseText: 'В корзину. Не более 10 штук в заказе',
  });

  assert.ok(snapshot);
  assert.deepEqual(snapshot.prices, [{ amountMinor: 10000000, currency: 'RUB' }]);
});

void test('preserves thousands separated by thin spaces in rendered Ozon prices', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    priceText: '188\u2009129\u2009₽\nС банками\n193\u2009036\u2009₽\nС другими банками',
  });

  assert.ok(snapshot);
  assert.deepEqual(
    snapshot.prices.map((price): number => price.amountMinor),
    [18812900, 19303600],
  );
});

void test('supports JSON-LD graph and validates product identity and currency', (): void => {
  const makeProduct = (sku: string, currency: string): object => ({
    '@type': 'Product',
    name: 'Notebook',
    sku,
    offers: {
      price: '12345.67',
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
    },
  });

  const snapshot = parser.parse(reference, {
    ...base,
    structuredData: [
      'broken JSON',
      JSON.stringify({ '@graph': [makeProduct(reference.id, 'RUB')] }),
    ],
  });

  assert.ok(snapshot);
  assert.equal(snapshot.prices[0]?.amountMinor, 1234567);
  assert.equal(snapshot.availability, 'in_stock');

  assert.equal(
    parser.parse(reference, {
      ...base,
      structuredData: [JSON.stringify(makeProduct('42', 'RUB'))],
    }),
    null,
  );
  assert.equal(
    parser.parse(reference, {
      ...base,
      structuredData: [JSON.stringify(makeProduct(reference.id, 'USD'))],
    }),
    null,
  );
});

void test('does not infer a price from recommendations or a challenge page', (): void => {
  assert.equal(parser.parse(reference, { ...base, body: 'Похожие товары 1 000 ₽' }), null);
  assert.equal(parser.isChallenge({ ...base, title: 'Antibot Captcha' }), true);
  assert.equal(parser.isChallenge({ ...base, body: 'Подтвердите, что вы человек' }), true);
  assert.equal(
    parser.parse(reference, {
      ...base,
      structuredData: [
        JSON.stringify({
          '@type': 'Product',
          name: 'Other product',
          offers: { price: 1000, priceCurrency: 'RUB' },
        }),
      ],
    }),
    null,
  );
});

void test('returns out-of-stock without inventing a zero price', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    purchaseText: 'Нет в наличии. Узнать о поступлении',
  });

  assert.ok(snapshot);
  assert.equal(snapshot.availability, 'out_of_stock');
  assert.deepEqual(snapshot.prices, []);
});
