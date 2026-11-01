import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { Camoufox } from 'camoufox-js';
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Route,
} from 'playwright-core';
import { DnsReferenceParser, ProductReferenceEntity } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import { CamoufoxOptionsFactory } from '../shared/camoufox-options.factory.js';
import { GeoIpPageParser } from '../shared/geo-ip-page.parser.js';
import { DnsCityCookieParser } from './dns-city-cookie.parser.js';
import { DnsPageParser } from './dns-page.parser.js';
import {
  DnsPlaywrightProductReaderAdapter,
  type DnsReaderParsersInterface,
} from './dns-playwright-product-reader.adapter.js';
import { DnsProductParser } from './dns-product.parser.js';

let browser: Browser;
beforeEach(async (): Promise<void> => {
  browser = await Camoufox({ headless: true });
});

afterEach(async (): Promise<void> => {
  await browser.close();
});

const moscow = '30b7c1f3-03fb-11dc-95ee-00151716f9f5';
const irkutsk = '30b7c1f1-03fb-11dc-95ee-00151716f9f5';
const reference = new ProductReferenceEntity(
  'dns',
  '0463bb2411a1d582',
  'https://www.dns-shop.ru/product/0463bb2411a1d582/',
);
const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
const parsers: DnsReaderParsersInterface = {
  geoIp: new GeoIpPageParser(),
  pages: new DnsPageParser(),
  products: new DnsProductParser(new DnsReferenceParser()),
  cities: new DnsCityCookieParser(),
};

const cityCookie = (cityId: string): string =>
  `abc%3A2%3A%7Bi%3A0%3Bs%3A12%3A%22current_path%22%3Bi%3A1%3Bs%3A116%3A%22%7B%22city%22%3A%22${cityId}%22%7D%22%3B%7D`;

const card = (price: string, button: string): string =>
  `<h1>Notebook</h1><div class="product-buy"><div class="product-buy__price">${price}</div>${button}</div>`;
const inStock = (price: string): string => card(price, '<button class="buy-btn">Купить</button>');
const outOfStock = (price: string): string => card(price, '<button class="notify-btn"></button>');

interface SiteInterface {
  /** The pages the site serves for the card, in order; the last one repeats. */
  pages: string[];
  status?: number;
  /** The city the browser has when it comes, by the cookie of the site. */
  cityId?: string;
  /** What the site answers to the request to change the city. */
  setCity?: { status: number; body: string };
}

function createReader(site: SiteInterface): {
  reader: DnsPlaywrightProductReaderAdapter;
  requests: string[];
} {
  const requests: string[] = [];
  let served = 0;
  const reader = new DnsPlaywrightProductReaderAdapter(
    {
      newContext: async (options?: BrowserContextOptions): Promise<BrowserContext> => {
        const context = await browser.newContext(options);
        if (site.cityId !== undefined) {
          await context.addCookies([
            {
              name: 'current_path',
              value: cityCookie(site.cityId),
              domain: '.dns-shop.ru',
              path: '/',
            },
          ]);
        }

        await context.route('**/*', async (route: Route): Promise<void> => {
          const url = route.request().url();
          if (url.startsWith('https://ipinfo.io/')) {
            await route.fulfill({ json: { ip: '217.71.230.103', country: 'RU' } });
          } else if (url === reference.url) {
            const html = site.pages[Math.min(served, site.pages.length - 1)] ?? '';
            served += 1;
            requests.push('card');
            await route.fulfill({
              status: site.status ?? 200,
              contentType: 'text/html; charset=utf-8',
              body: html,
            });
          } else if (url === 'https://www.dns-shop.ru/city-service/set-city/') {
            requests.push(`set-city ${route.request().postData() ?? ''}`);
            await route.fulfill({
              status: site.setCity?.status ?? 200,
              contentType: 'application/json',
              body: site.setCity?.body ?? '""',
              headers: { 'access-control-allow-origin': '*' },
            });
          } else {
            await route.abort();
          }
        });

        return context;
      },
    },
    new CamoufoxOptionsFactory(),
    parsers,
    10_000,
  );

  return { reader, requests };
}

void test('reads the price of a product that is in stock, through a proxy, in the city the site chose', async (): Promise<void> => {
  const { reader, requests } = createReader({ pages: [inStock('153 999 ₽')], cityId: moscow });

  const result = await reader.read(reference, proxy, new AbortController().signal);

  assert.equal(result.status, 'success');
  assert.ok('snapshot' in result);
  assert.deepEqual(result.snapshot.prices, [{ amountMinor: 15399900, currency: 'RUB' }]);
  assert.equal(result.snapshot.availability, 'in_stock');
  assert.equal(result.exitIp, '217.71.230.103');
  assert.deepEqual(requests, ['card']);
  assert.equal(browser.contexts().length, 0);
});

void test('reads the price of a product that is out of stock', async (): Promise<void> => {
  const { reader } = createReader({ pages: [outOfStock('204 999 ₽')] });

  const result = await reader.read(reference, null, new AbortController().signal);

  assert.ok('snapshot' in result);
  assert.equal(result.snapshot.availability, 'out_of_stock');
  assert.deepEqual(result.snapshot.prices, [{ amountMinor: 20499900, currency: 'RUB' }]);
});

void test('leaves the city alone when the site has chosen the one that is asked for', async (): Promise<void> => {
  const { reader, requests } = createReader({
    pages: [inStock('152 999 ₽')],
    cityId: irkutsk,
  });

  await reader.read(reference.inCity(irkutsk), null, new AbortController().signal);

  assert.deepEqual(requests, ['card']);
});

void test('changes the city of the site and reads the card again, so that the price is the one of the city', async (): Promise<void> => {
  const { reader, requests } = createReader({
    pages: [inStock('153 999 ₽'), inStock('152 999 ₽')],
    cityId: moscow,
    setCity: { status: 200, body: JSON.stringify(irkutsk) },
  });

  const result = await reader.read(reference.inCity(irkutsk), null, new AbortController().signal);

  assert.ok('snapshot' in result);
  assert.deepEqual(result.snapshot.prices, [{ amountMinor: 15299900, currency: 'RUB' }]);
  assert.deepEqual(requests, ['card', `set-city {"cityId":"${irkutsk}"}`, 'card']);
});

void test('does not report the price of another city when the city cannot be changed', async (): Promise<void> => {
  const { reader } = createReader({
    pages: [inStock('153 999 ₽')],
    cityId: moscow,
    setCity: { status: 500, body: '' },
  });

  assert.deepEqual(
    await reader.read(reference.inCity(irkutsk), null, new AbortController().signal),
    {
      status: 'parse_error',
    },
  );
});

void test('reports an HTTP error and a page that is no card', async (): Promise<void> => {
  const forbidden = createReader({ pages: ['<h1>Forbidden</h1>'], status: 403 });
  assert.deepEqual(await forbidden.reader.read(reference, null, new AbortController().signal), {
    status: 'http_error',
    httpStatus: 403,
  });

  const empty = createReader({ pages: ['<p>nothing</p>'] });
  assert.deepEqual(await empty.reader.read(reference, null, new AbortController().signal), {
    status: 'parse_error',
  });
});

void test('waits for the price that the card draws after an empty block of it is on the page', async (): Promise<void> => {
  const { reader } = createReader({
    pages: [
      `<h1>Notebook</h1><div class="product-buy"><div class="product-buy__price" style="height:10px"></div></div>
       <script>setTimeout(() => {
         const buy = document.querySelector('.product-buy');
         buy.querySelector('.product-buy__price').textContent = '152 999 ₽';
         buy.insertAdjacentHTML('beforeend', '<button class="buy-btn">Купить</button>');
       }, 60);</script>`,
    ],
  });

  const result = await reader.read(reference, null, new AbortController().signal);

  assert.ok('snapshot' in result);
  assert.deepEqual(result.snapshot.prices, [{ amountMinor: 15299900, currency: 'RUB' }]);
  assert.equal(result.snapshot.availability, 'in_stock');
});
