import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  chromium,
  type Route,
} from 'playwright';
import { OzonReferenceParser, ProductReferenceEntity } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type { BrowserSessionInterface } from '../../domain/session/browser-session.interface.js';
import { ChromiumOptionsFactory } from '../shared/chromium-options.factory.js';
import { GeoIpPageParser } from '../shared/geo-ip-page.parser.js';
import { OzonChallengeParser } from './ozon-challenge.parser.js';
import { OzonPageParser } from './ozon-page.parser.js';
import {
  OzonPlaywrightProductReaderAdapter,
  type OzonReaderParsersInterface,
} from './ozon-playwright-product-reader.adapter.js';
import { OzonProductParser } from './ozon-product.parser.js';

let browser: Browser;
before(async (): Promise<void> => {
  browser = await chromium.launch({ headless: true });
});

after(async (): Promise<void> => {
  await browser.close();
});

const reference = new ProductReferenceEntity(
  'ozon',
  '4775581891',
  'https://www.ozon.ru/product/4775581891/',
);
const proxy = new ProxyEndpointEntity('socks5://217.71.230.103:1080');
const parsers: OzonReaderParsersInterface = {
  geoIp: new GeoIpPageParser(),
  pages: new OzonPageParser(),
  challenges: new OzonChallengeParser(),
  products: new OzonProductParser(new OzonReferenceParser()),
};

function createReader(
  html: string,
  country = 'RU',
  status = 200,
  inspectOptions?: (options: BrowserContextOptions | undefined) => void,
  sessions?: SessionStorePort,
): OzonPlaywrightProductReaderAdapter {
  return new OzonPlaywrightProductReaderAdapter(
    {
      newContext: async (options?: BrowserContextOptions): Promise<BrowserContext> => {
        inspectOptions?.(options);
        const context = await browser.newContext(options);

        await context.route('**/*', async (route: Route): Promise<void> => {
          if (route.request().url().startsWith('https://ipinfo.io/')) {
            await route.fulfill({ json: { ip: '217.71.230.103', country } });
          } else if (route.request().url() === reference.url) {
            await route.fulfill({ status, contentType: 'text/html; charset=utf-8', body: html });
          } else {
            await route.abort();
          }
        });

        return context;
      },
    },
    new ChromiumOptionsFactory(),
    parsers,
    1000,
    sessions,
  );
}

void test('headless reader waits for rendered prices and excludes hidden and struck amounts', async (): Promise<void> => {
  const reader = createReader(`<h1>Notebook</h1><style>
    .old-price { position: relative; }
    .old-price::after { content: ''; position: absolute; height: 1px; left: 0; top: calc(50% - 1px); width: 100%; background: #777; }
  </style><script>
    setTimeout(() => {
      document.body.insertAdjacentHTML('beforeend', '<div data-widget="webPrice"><span>90\u2009000 ₽</span><span>с Ozon Картой</span><del>120 000 ₽</del><span class="old-price">817\u2009949 ₽</span><span style="display:none">150 000 ₽</span><span>100 000 ₽</span><span>без Ozon Карты</span></div><div data-widget="webAddToCart">В корзину. Осталось 2 штуки</div><div data-widget="webCustoms">Таможенный платёж ~5 000 ₽</div>');
    }, 25);
  </script>`);

  const result = await reader.read(reference, proxy, new AbortController().signal);

  assert.equal(result.status, 'success');
  assert.ok('snapshot' in result);
  assert.deepEqual(
    result.snapshot.prices.map((price): number => price.amountMinor),
    [9000000, 10000000],
  );
  assert.equal(result.exitIp, '217.71.230.103');
  assert.equal(browser.contexts().length, 0);
});

void test('headless reader reports an HTTP 403 challenge without parsing fake prices', async (): Promise<void> => {
  const reader = createReader(
    '<title>Antibot Captcha</title><div class="captcha">Подтвердите, что вы человек</div><h1>100 ₽</h1>',
    'RU',
    403,
  );

  assert.deepEqual(await reader.read(reference, proxy, new AbortController().signal), {
    status: 'challenge_required',
  });
  assert.equal(browser.contexts().length, 0);
});

void test('reader accepts the final document after a JavaScript challenge redirects from HTTP 403 to 200', async (): Promise<void> => {
  const reader = new OzonPlaywrightProductReaderAdapter(
    {
      newContext: async (options?: BrowserContextOptions): Promise<BrowserContext> => {
        const context = await browser.newContext(options);

        await context.route('**/*', async (route: Route): Promise<void> => {
          if (route.request().url() === reference.url) {
            await route.fulfill({
              status: 403,
              contentType: 'text/html',
              body: '<title>Antibot Challenge Page</title><script>setTimeout(() => location.replace("?verified=1"), 25)</script>',
            });
          } else {
            await route.fulfill({
              contentType: 'text/html; charset=utf-8',
              body: '<h1>Notebook</h1><div data-widget="webPrice">100 000 ₽</div>',
            });
          }
        });

        return context;
      },
    },
    new ChromiumOptionsFactory(),
    parsers,
    1000,
  );

  const result = await reader.read(reference, null, new AbortController().signal);

  assert.equal(result.status, 'success');
  assert.ok('snapshot' in result);
  assert.equal(result.snapshot.prices[0]?.amountMinor, 10000000);
  assert.equal(browser.contexts().length, 0);
});

void test('headless reader rejects a non-Russian exit before loading the product', async (): Promise<void> => {
  const reader = createReader('<h1>Must not be read</h1>', 'US');

  assert.deepEqual(await reader.read(reference, proxy, new AbortController().signal), {
    status: 'proxy_rejected',
  });
});

void test('headless reader keeps an unavailable product distinct from a parsing failure', async (): Promise<void> => {
  const reader = createReader(
    '<h1>Notebook</h1><div data-widget="webOutOfStock">Нет в наличии</div>',
  );

  const result = await reader.read(reference, proxy, new AbortController().signal);

  assert.ok('snapshot' in result);
  assert.equal(result.snapshot.availability, 'out_of_stock');
  assert.deepEqual(result.snapshot.prices, []);
});

void test('direct reader omits proxy configuration and skips GeoIP even for a non-Russian connection', async (): Promise<void> => {
  const reader = createReader(
    '<h1>Notebook</h1><div data-widget="webPrice">100 000 ₽</div>',
    'US',
    200,
    (options): void => {
      assert.equal(options?.proxy, undefined);
    },
  );

  const result = await reader.read(reference, null, new AbortController().signal);

  assert.equal(result.status, 'success');
  assert.ok('snapshot' in result);
  assert.equal(result.exitIp, null);
  assert.equal(result.snapshot.prices[0]?.amountMinor, 10000000);
  assert.equal(browser.contexts().length, 0);
});

const widgetHtml =
  '<h1>Notebook</h1><div data-widget="webPrice"><span>100 000 ₽</span></div><div data-widget="webAddToCart">В корзину</div>';
const session: BrowserSessionInterface = {
  id: '3f0c9a52-7a53-4a64-9d0d-2f2f6c1f0a11',
  exitIp: '217.71.230.103',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) SessionTest',
  storageState: {
    cookies: [
      {
        name: 'abt',
        value: 'v1',
        domain: '.ozon.ru',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  },
};

function createSessionSpy(found: BrowserSessionInterface | null): {
  store: SessionStorePort;
  updates: string[];
  rejections: string[];
} {
  const updates: string[] = [];
  const rejections: string[] = [];

  return {
    updates,
    rejections,
    store: {
      find: (): BrowserSessionInterface | null => found,
      update: (sessionId): void => {
        updates.push(sessionId);
      },
      reject: (sessionId, actualIp): void => {
        rejections.push(`${sessionId}@${actualIp}`);
      },
    },
  };
}

void test('reader applies a session and stores the refreshed state after a successful read', async (): Promise<void> => {
  const spy = createSessionSpy(session);
  const received: Array<BrowserContextOptions | undefined> = [];
  const reader = createReader(
    widgetHtml,
    'RU',
    200,
    (options): void => {
      received.push(options);
    },
    spy.store,
  );

  const result = await reader.read(reference, proxy, new AbortController().signal);
  assert.equal(result.status, 'success');

  const options = received[0];
  assert.equal(options?.userAgent, session.userAgent);
  assert.equal(options.timezoneId, 'Europe/Moscow');
  assert.deepEqual(options.storageState, session.storageState);
  assert.deepEqual(spy.updates, [session.id]);
  assert.deepEqual(spy.rejections, []);
});

void test('reader ignores a session created with another exit address', async (): Promise<void> => {
  const spy = createSessionSpy({ ...session, exitIp: '198.51.100.7' });
  const reader = createReader(widgetHtml, 'RU', 200, undefined, spy.store);

  const result = await reader.read(reference, proxy, new AbortController().signal);

  assert.equal(result.status, 'success');
  assert.deepEqual(spy.rejections, [`${session.id}@217.71.230.103`]);
  assert.deepEqual(spy.updates, []);
});

void test('reader does not store a session after a challenge', async (): Promise<void> => {
  const spy = createSessionSpy(session);
  const reader = createReader(
    '<title>Antibot Captcha</title><div class="captcha">Подтвердите, что вы человек</div>',
    'RU',
    403,
    undefined,
    spy.store,
  );

  assert.deepEqual(await reader.read(reference, proxy, new AbortController().signal), {
    status: 'challenge_required',
  });
  assert.deepEqual(spy.updates, []);
});
