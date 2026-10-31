import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  chromium,
  type Route,
} from 'playwright';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import { ChromiumOptionsFactory } from './chromium-options.factory.js';
import { DnsBrowserCitySourceAdapter } from './dns-browser-city-source.adapter.js';

let browser: Browser;
before(async (): Promise<void> => {
  browser = await chromium.launch({ headless: true });
});

after(async (): Promise<void> => {
  await browser.close();
});

interface SiteInterface {
  /** Whether the site shows its pages; otherwise it keeps showing a check. */
  opens?: boolean;
  /** The answer of the API to a letter. */
  api?: (letter: string) => { status: number; body: unknown };
}

function createSource(
  site: SiteInterface,
  inspect?: (options: BrowserContextOptions | undefined) => void,
): { source: DnsBrowserCitySourceAdapter; asked: string[] } {
  const asked: string[] = [];
  const source = new DnsBrowserCitySourceAdapter(
    {
      newContext: async (options?: BrowserContextOptions): Promise<BrowserContext> => {
        inspect?.(options);
        const context = await browser.newContext(options);
        await context.route('**/*', async (route: Route): Promise<void> => {
          const url = new URL(route.request().url());
          if (url.origin === 'https://www.dns-shop.ru') {
            await route.fulfill({
              contentType: 'text/html; charset=utf-8',
              body:
                site.opens === false
                  ? '<title>Check</title>'
                  : '<div class="header-top-menu__city-selector">Москва</div>',
            });
          } else if (url.origin === 'https://restapi.dns-shop.ru') {
            const letter = url.searchParams.get('letter') ?? '';
            asked.push(letter);
            const answer = site.api?.(letter) ?? { status: 200, body: { data: { cities: [] } } };
            await route.fulfill({
              status: answer.status,
              json: answer.body,
              headers: {
                'access-control-allow-origin': 'https://www.dns-shop.ru',
                'access-control-allow-credentials': 'true',
              },
            });
          } else {
            await route.abort();
          }
        });

        return context;
      },
    },
    new ChromiumOptionsFactory(),
    1500,
  );

  return { source, asked };
}

const signal = new AbortController().signal;

void test('opens the site once, and asks its API from the page for every letter, mapping the cities', async (): Promise<void> => {
  const { source, asked } = createSource({
    api: (letter) => ({
      status: 200,
      body: {
        message: '',
        data: {
          cities: [
            {
              id: `${letter}-1`,
              name: ` Город ${letter} `,
              regionName: 'Область',
              citySlug: 'x',
              shopUrl: '/',
            },
            { id: `${letter}-2`, name: 'Без области', regionName: '' },
          ],
        },
      },
    }),
  });

  const session = await source.open(null, signal);
  const first = await session.read('А', signal);
  const second = await session.read('Б', signal);
  await session.close();

  assert.deepEqual(first, [
    { id: 'А-1', name: 'Город А', region: 'Область' },
    { id: 'А-2', name: 'Без области', region: null },
  ]);
  assert.equal(second[0]?.id, 'Б-1');
  assert.deepEqual(asked, ['А', 'Б']);
  assert.equal(browser.contexts().length, 0);
});

void test('connects through the proxy it is given', async (): Promise<void> => {
  let given: BrowserContextOptions | undefined;
  const { source } = createSource({}, (options) => {
    given = options;
  });

  await (await source.open(new ProxyEndpointEntity('socks5://217.71.230.1:1080'), signal)).close();

  assert.equal(given?.proxy?.server, 'socks5://217.71.230.1:1080');
});

void test('does not open when the site keeps showing a check, and leaves no browser context behind', async (): Promise<void> => {
  const { source } = createSource({ opens: false });

  await assert.rejects(source.open(null, signal));
  assert.equal(browser.contexts().length, 0);
});

void test('rejects an answer that is not the list of cities, or not a success', async (): Promise<void> => {
  const answers = [
    { status: 403, body: {} },
    { status: 200, body: { data: {} } },
    { status: 200, body: { data: { cities: [{ name: 'no id' }] } } },
  ];

  for (const answer of answers) {
    const { source } = createSource({ api: () => answer });
    const session = await source.open(null, signal);

    await assert.rejects(session.read('А', signal));
    await session.close();
  }
});

void test('does not open when the job is already aborted', async (): Promise<void> => {
  const { source } = createSource({});

  await assert.rejects(source.open(null, AbortSignal.abort()));
});
