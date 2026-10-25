import { parseArgs } from 'node:util';

import { type BrowserContext, type BrowserContextOptions, chromium } from 'playwright';
import { ResolveProductReferenceUseCase } from 'product-reference';
import { OzonReferenceParser } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';
import { z } from 'zod';

import { GetProductSnapshotUseCase } from '../../application/product/get-product-snapshot.use-case.js';
import { OzonPlaywrightProductReaderAdapter } from '../../infrastructure/ozon/ozon-playwright-product-reader.adapter.js';
import { OzonProductParser } from '../../infrastructure/ozon/ozon-product.parser.js';
import { MarketplaceProductReaderAdapter } from '../../infrastructure/product/marketplace-product-reader.adapter.js';
import { PublicProxyProviderAdapter } from '../../infrastructure/proxy/public-proxy-provider.adapter.js';
import { FileSessionStoreAdapter } from '../../infrastructure/session/file-session-store.adapter.js';
import { ChromiumLaunchAdapter } from '../../infrastructure/shared/chromium-launch.adapter.js';

export async function runTrackerCli(args: string[] = process.argv.slice(2)): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      proxy: { type: 'string' },
      direct: { type: 'boolean' },
      'max-proxies': { type: 'string', default: '5' },
      'timeout-ms': { type: 'string', default: '15000' },
      'browser-path': { type: 'string' },
      headed: { type: 'boolean' },
      'user-data-dir': { type: 'string' },
      'session-file': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help === true) {
    console.log(
      'Usage: pnpm start <ozon-product-url> [--direct | --proxy socks5://IP:PORT] [--max-proxies 5] [--timeout-ms 15000] [--browser-path /usr/bin/chromium] [--headed] [--user-data-dir .ozon-browser] [--session-file session.json]',
    );
    return;
  }
  // pnpm forwards arguments directly; tolerate an explicit separator too.
  const argumentsList = positionals.filter((value): boolean => value !== '--');
  if (argumentsList.length !== 1 || argumentsList[0] === undefined)
    throw new Error('Provide exactly one product URL. Use --help for usage.');
  const reference = new ResolveProductReferenceUseCase([new OzonReferenceParser()]).execute(
    argumentsList[0],
  );
  if (values.direct === true && values.proxy !== undefined) {
    throw new Error('--direct and --proxy cannot be used together');
  }
  const userDataDir = z.string().min(1).optional().parse(values['user-data-dir']);
  if (userDataDir !== undefined && values.direct !== true && values.proxy === undefined) {
    throw new Error(
      '--user-data-dir requires --direct or --proxy to keep the session on one route',
    );
  }
  const limit = z.coerce.number().int().min(1).max(20).parse(values['max-proxies']);
  const timeoutMs = z.coerce.number().int().min(1000).max(60000).parse(values['timeout-ms']);
  const override =
    values.direct === true
      ? null
      : values.proxy === undefined
        ? undefined
        : new ProxyEndpointEntity(values.proxy);
  const launchOptions = new ChromiumLaunchAdapter().launchOptions({
    headed: values.headed === true,
    timeoutMs,
    ...(values['browser-path'] === undefined ? {} : { executablePath: values['browser-path'] }),
  });
  const sessionFile = z.string().min(1).optional().parse(values['session-file']);
  const sessions =
    sessionFile === undefined ? undefined : await FileSessionStoreAdapter.load(sessionFile);
  const browser = userDataDir === undefined ? await chromium.launch(launchOptions) : null;
  const contexts = browser ?? {
    newContext: (options?: BrowserContextOptions): Promise<BrowserContext> =>
      chromium.launchPersistentContext(userDataDir ?? '', {
        ...launchOptions,
        ...options,
        viewport: null,
      }),
  };
  const controller = new AbortController();
  const stop = (signal: NodeJS.Signals): void => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const useCase = new GetProductSnapshotUseCase(
      new PublicProxyProviderAdapter(limit),
      new MarketplaceProductReaderAdapter({
        ozon: new OzonPlaywrightProductReaderAdapter(
          contexts,
          new OzonProductParser(),
          timeoutMs,
          sessions,
        ),
      }),
    );
    const result = await useCase.execute(reference, controller.signal, override);
    console.log(JSON.stringify(result, null, 2));
    if (!['success', 'partial'].includes(result.status)) process.exitCode = 2;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await browser?.close();
  }
}
