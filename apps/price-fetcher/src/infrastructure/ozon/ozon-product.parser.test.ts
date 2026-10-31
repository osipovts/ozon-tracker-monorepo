import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OzonReferenceParser, ProductReferenceEntity } from 'product-reference';

import type { OzonPageInterface } from './ozon-page.interface.js';
import { OzonProductParser } from './ozon-product.parser.js';

const reference = new ProductReferenceEntity(
  'ozon',
  '4775581891',
  'https://www.ozon.ru/product/4775581891/',
);
const parser = new OzonProductParser(new OzonReferenceParser());
const base: OzonPageInterface = {
  url: reference.url,
  title: 'Notebook',
  heading: 'Notebook',
  body: '',
  priceText: '',
  purchaseText: '',
  outOfStockText: '',
  outOfStockImageUrl: '',
  structuredData: [],
  imageUrl: '',
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

void test('does not infer a price from recommendations or another page', (): void => {
  assert.equal(parser.parse(reference, { ...base, body: 'Похожие товары 1 000 ₽' }), null);
  assert.equal(
    parser.parse(reference, {
      ...base,
      url: 'https://www.ozon.ru/product/1/',
      priceText: '100 000 ₽',
    }),
    null,
  );
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

const searchUrl =
  'https://www.ozon.ru/search/?deny_category_prediction=true&from_global=true&text=ASUS+UX3607OA-SQ050W';
const soldOutWidget =
  '203\u00a0489 ₽\nASUS UX3607OA-SQ050W Ноутбук 16", RAM 48 ГБ, SSD 1000 ГБ, Qualcomm Adreno, Windows Home, бежевый';

void test('reads a product that is out of stock from the search Ozon sends its address to, with its last price', (): void => {
  const snapshot = parser.parse(reference, {
    ...base,
    url: searchUrl,
    heading: '',
    purchaseText: soldOutWidget,
    outOfStockText: soldOutWidget,
    outOfStockImageUrl: 'https://ir.ozone.ru/s3/multimedia-1-e/wc100/10327863470.jpg',
    imageUrl: 'https://ir.ozone.ru/s3/cms/logo/og_ozon_ru.png',
  });

  assert.ok(snapshot);
  assert.equal(snapshot.availability, 'out_of_stock');
  assert.deepEqual(snapshot.prices, [{ amountMinor: 20348900, currency: 'RUB' }]);
  assert.equal(
    snapshot.title,
    'ASUS UX3607OA-SQ050W Ноутбук 16", RAM 48 ГБ, SSD 1000 ГБ, Qualcomm Adreno, Windows Home, бежевый',
  );
  assert.equal(snapshot.imageUrl, 'https://ir.ozone.ru/s3/multimedia-1-e/wc300/10327863470.jpg');
});

void test('does not take a search without the sold out widget, or another site, for the product', (): void => {
  assert.equal(parser.parse(reference, { ...base, url: searchUrl, heading: '' }), null);
  assert.equal(
    parser.parse(reference, {
      ...base,
      url: 'https://example.com/search/?text=x',
      outOfStockText: soldOutWidget,
    }),
    null,
  );
});

void test('takes the sold out widget of the card itself for out of stock whatever it says', (): void => {
  const snapshot = parser.parse(reference, { ...base, outOfStockText: 'Сообщить о поступлении' });

  assert.ok(snapshot);
  assert.equal(snapshot.availability, 'out_of_stock');
});

void test('takes the picture of the product from its markup, else from the page, and only an address a browser loads', (): void => {
  const withMarkup = (image: unknown): OzonPageInterface => ({
    ...base,
    priceText: '100 ₽',
    structuredData: [
      JSON.stringify({
        '@type': 'Product',
        name: 'Notebook',
        sku: reference.id,
        image,
        offers: { price: '100', priceCurrency: 'RUB' },
      }),
    ],
  });

  assert.equal(
    parser.parse(reference, withMarkup(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']))
      ?.imageUrl,
    'https://cdn.example/a.jpg',
  );
  assert.equal(
    parser.parse(reference, withMarkup('https://cdn.example/one.jpg'))?.imageUrl,
    'https://cdn.example/one.jpg',
  );

  // None in the markup: the picture the page names for sharing.
  assert.equal(
    parser.parse(reference, { ...withMarkup(undefined), imageUrl: 'https://cdn.example/og.jpg' })
      ?.imageUrl,
    'https://cdn.example/og.jpg',
  );

  // Not an address to load: none.
  assert.equal(parser.parse(reference, withMarkup('javascript:alert(1)'))?.imageUrl, null);
  assert.equal(parser.parse(reference, withMarkup('/relative.jpg'))?.imageUrl, null);
  assert.equal(parser.parse(reference, { ...withMarkup(undefined), imageUrl: '' })?.imageUrl, null);
});

void test('asks the CDN of Ozon for the small size of the picture, of a full-size address or of another size', (): void => {
  const pictureOf = (image: string): string | null | undefined =>
    parser.parse(reference, {
      ...base,
      priceText: '100 ₽',
      structuredData: [
        JSON.stringify({
          '@type': 'Product',
          name: 'Notebook',
          sku: reference.id,
          image,
          offers: { price: '100', priceCurrency: 'RUB' },
        }),
      ],
    })?.imageUrl;

  assert.equal(
    pictureOf('https://ir.ozone.ru/s3/multimedia-1-u/11648158482.jpg'),
    'https://ir.ozone.ru/s3/multimedia-1-u/wc300/11648158482.jpg',
  );
  assert.equal(
    pictureOf('https://ir.ozone.ru/s3/multimedia-1-u/c1000/11648158482.jpg'),
    'https://ir.ozone.ru/s3/multimedia-1-u/wc300/11648158482.jpg',
  );
  // Another host, or an address of another shape, is left as the page gave it.
  assert.equal(pictureOf('https://cdn.example/s3/b/1.jpg'), 'https://cdn.example/s3/b/1.jpg');
  assert.equal(pictureOf('https://ir.ozone.ru/other/1.jpg'), 'https://ir.ozone.ru/other/1.jpg');
});
