import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';

import { type Browser, chromium, type Page } from 'playwright';

import { DockerStackAdapter } from './support/docker-stack.adapter.js';
import { FakePriceWorkerAdapter } from './support/fake-price-worker.adapter.js';
import {
  connectDatabase,
  type RunningHubInterface,
  seedProxies,
  startHub,
} from './support/hub-harness.js';

/**
 * The client app as a person uses it: the built app in a real Chromium, served by the real hub over a real
 * Postgres and Redis, with the price worker the one stand-in (as in the price tests). The app must be built
 * first (`pnpm --filter frontend-client build`).
 */
const stack = new DockerStackAdapter();
const email = 'jane@example.com';
const password = 'correct-horse';
const productUrl = 'https://www.ozon.ru/product/4775581891/';
let hub: RunningHubInterface;
let worker: FakePriceWorkerAdapter;
let database: ReturnType<typeof connectDatabase>;
let browser: Browser;
let page: Page;

before(
  async (): Promise<void> => {
    const infrastructure = await stack.start();
    database = connectDatabase(infrastructure.databaseUrl);
    await seedProxies(database, ['socks5://217.71.230.1:1080']);

    worker = new FakePriceWorkerAdapter(infrastructure.redisUrl);
    worker.setPrice(productUrl, 129_900);
    worker.start();

    hub = await startHub({
      stack: infrastructure,
      env: { CLIENT_UI_DIR: resolve(import.meta.dirname, '../../../frontend-client/dist') },
    });
    browser = await chromium.launch();
    page = await (await browser.newContext()).newPage();
  },
  { timeout: 120_000 },
);

after(
  async (): Promise<void> => {
    await browser.close();
    await hub.stop();
    await worker.stop();
    await database.$disconnect();
    await stack.stop();
  },
  { timeout: 60_000 },
);

void test('a visitor signs up, and is logged in', async (): Promise<void> => {
  await page.goto(`${hub.baseUrl}/app/`);
  await page.waitForURL('**/app/login');

  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();

  await page.getByRole('heading', { name: 'Products' }).waitFor();
  await page.getByRole('button', { name: 'Log out' }).waitFor();
});

void test('a product is added by its link, and shows its first price when a worker has read it', async (): Promise<void> => {
  await page.getByLabel('Link to a product').fill(productUrl);
  await page.getByRole('button', { name: 'Track' }).click();

  // The list follows the job by itself: no reload.
  await page.getByText(/1\s299,00/).waitFor({ timeout: 20_000 });
  assert.equal(worker.jobs.length, 1);
});

void test('the page of the product has the price, two charts side by side, and the history', async (): Promise<void> => {
  // Older prices with gaps between them, as the schedule would have left in a day.
  const product = await database.trackedProduct.findFirstOrThrow();
  const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);
  await database.priceObservation.createMany({
    data: [6, 4].map((hours) => ({
      trackedProductId: product.id,
      jobId: randomUUID(),
      title: 'ASUS',
      observedAt: hoursAgo(hours),
      availability: 'in_stock',
      prices: [{ amountMinor: 100_000 + hours * 1000, currency: 'RUB' }],
    })),
  });

  await page.getByRole('link', { name: /.+/ }).filter({ hasText: /\S/ }).first().waitFor();
  await page.goto(`${hub.baseUrl}/app/products/${product.id}`);
  await page.getByRole('heading', { level: 3, name: /1\s299,00/ }).waitFor();

  const charts = page.locator('.recharts-wrapper');
  await charts.nth(1).waitFor();
  assert.equal(await charts.count(), 2);

  // Side by side: the same row, and each takes half of it.
  const [first, second] = await Promise.all([
    charts.nth(0).boundingBox(),
    charts.nth(1).boundingBox(),
  ]);
  assert.ok(first && second);
  assert.ok(Math.abs(first.y - second.y) < 2);
  assert.ok(Math.abs(first.width - second.width) < 40);
  assert.ok(second.x > first.x + first.width / 2);

  // The hours with no price are drawn dashed.
  assert.ok((await page.locator('.recharts-line-curve[stroke-dasharray]').count()) >= 1);

  // The history lists all three prices.
  assert.equal(await page.locator('tbody tr').count(), 3);
});

void test('the hint of a point tells the average, the minimum, the maximum and the last price, or the last known one', async (): Promise<void> => {
  const chart = page.locator('.recharts-wrapper').nth(0);
  const box = await chart.boundingBox();
  assert.ok(box);
  const tooltip = page.locator('.recharts-tooltip-wrapper');
  const hover = async (fromRight: number): Promise<void> => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - fromRight, box.y + box.height / 2, { steps: 10 });
  };

  // The right edge of the chart is the current hour, where the price of the worker is.
  await hover(18);
  await tooltip.getByText(/Average:/).waitFor();
  await tooltip.getByText(/Min:/).waitFor();
  await tooltip.getByText(/Max:/).waitFor();
  await tooltip.getByText(/Last:/).waitFor();

  // The hour before it had no price: the hint says what was known last.
  await hover(27);
  await tooltip.getByText(/Last known:/).waitFor();
});

void test('a visitor who logs out is sent to the login', async (): Promise<void> => {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL('**/app/login');
});

void test('the language follows the browser, and a language that is picked is kept', async (): Promise<void> => {
  // A browser that asks for Russian sends `Accept-Language: ru-RU` and reports it to the page.
  const context = await browser.newContext({ locale: 'ru-RU' });
  const russian = await context.newPage();
  await russian.goto(`${hub.baseUrl}/app/login`);
  await russian.getByRole('heading', { name: 'Трекер цен' }).waitFor();
  assert.equal(await russian.locator('html').getAttribute('lang'), 'ru');

  await russian.getByText('EN', { exact: true }).click();
  await russian.getByRole('heading', { name: 'Price tracker' }).waitFor();

  await russian.reload();
  await russian.getByRole('heading', { name: 'Price tracker' }).waitFor();
  await context.close();

  // A browser with a language the app has no words in gets English.
  const german = await browser.newContext({ locale: 'de-DE' });
  const other = await german.newPage();
  await other.goto(`${hub.baseUrl}/app/login`);
  await other.getByRole('heading', { name: 'Price tracker' }).waitFor();
  await german.close();
});
