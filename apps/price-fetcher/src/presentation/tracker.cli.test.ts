import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';

import { type BrowserContext, chromium, type Route } from 'playwright';

import { runTrackerCli } from './tracker.cli.js';

void test('rejects direct mode combined with an explicit proxy before launching a browser', async (): Promise<void> => {
  await assert.rejects(
    runTrackerCli([
      'https://ozon.ru/product/1/',
      '--direct',
      '--proxy',
      'socks5://217.71.230.103:1080',
    ]),
    /--direct and --proxy cannot be used together/,
  );
});

void test('requires an explicit route for a persistent browser session', async (): Promise<void> => {
  await assert.rejects(
    runTrackerCli(['https://ozon.ru/product/1/', '--user-data-dir', '.ozon-browser']),
    /--user-data-dir requires --direct or --proxy/,
  );
});

void test('persistent CLI sessions retain cookies across browser restarts', async (testContext: TestContext): Promise<void> => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'ozon-session-test-'));
  const launchPersistentContext = chromium.launchPersistentContext.bind(chromium);
  const requests: string[] = [];
  testContext.mock.method(
    chromium,
    'launchPersistentContext',
    async (
      directory: string,
      options?: Parameters<typeof chromium.launchPersistentContext>[1],
    ): Promise<BrowserContext> => {
      const context = await launchPersistentContext(directory, options);
      await context.route('**/*', async (route: Route): Promise<void> => {
        requests.push(route.request().headers()['cookie'] ?? '');
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          headers: { 'set-cookie': 'verified=1; Path=/; Secure; Max-Age=3600' },
          body: '<h1>Notebook</h1><div data-widget="webPrice">100 000 ₽</div>',
        });
      });
      return context;
    },
  );
  testContext.mock.method(console, 'log', (): void => {
    // Keep successful CLI JSON out of the test runner output.
  });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await runTrackerCli([
        'https://ozon.ru/product/1/',
        '--direct',
        '--user-data-dir',
        userDataDir,
        '--timeout-ms',
        '1000',
      ]);
    }
    assert.equal(requests.length, 2);
    assert.equal(requests[0], '');
    assert.equal(requests[1], 'verified=1');
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
});
