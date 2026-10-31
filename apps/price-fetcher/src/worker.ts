import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { chromium } from 'playwright';
import {
  DnsReferenceParser,
  OzonReferenceParser,
  OzonShortLinkParser,
  ResolveProductReferenceUseCase,
} from 'product-reference';
import { type PriceFetchResultType, queueNames } from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser, QueueWorkerRunner } from 'queue-worker';
import { z } from 'zod';

import { ExpandLinkUseCase } from './application/link/expand-link.use-case.js';
import { FetchPricesUseCase } from './application/product/fetch-prices.use-case.js';
import { DnsCityCookieParser } from './infrastructure/dns/dns-city-cookie.parser.js';
import { DnsPageParser } from './infrastructure/dns/dns-page.parser.js';
import { DnsPlaywrightProductReaderAdapter } from './infrastructure/dns/dns-playwright-product-reader.adapter.js';
import { DnsProductParser } from './infrastructure/dns/dns-product.parser.js';
import { OzonChallengeParser } from './infrastructure/ozon/ozon-challenge.parser.js';
import { OzonPageParser } from './infrastructure/ozon/ozon-page.parser.js';
import { OzonPlaywrightLinkExpanderAdapter } from './infrastructure/ozon/ozon-playwright-link-expander.adapter.js';
import {
  OzonPlaywrightProductReaderAdapter,
  type OzonReaderParsersInterface,
} from './infrastructure/ozon/ozon-playwright-product-reader.adapter.js';
import { OzonProductParser } from './infrastructure/ozon/ozon-product.parser.js';
import { MarketplaceProductReaderAdapter } from './infrastructure/product/marketplace-product-reader.adapter.js';
import { InMemorySessionStoreAdapter } from './infrastructure/session/in-memory-session-store.adapter.js';
import { ChromiumOptionsFactory } from './infrastructure/shared/chromium-options.factory.js';
import { GeoIpPageParser } from './infrastructure/shared/geo-ip-page.parser.js';
import { LinkExpandController } from './presentation/link/link-expand.controller.js';
import { PriceFetchController } from './presentation/product/price-fetch.controller.js';

const env = z
  .object({
    redisUrl: z.string().default('redis://localhost:6379'),
    headed: z.stringbool().default(true),
    browserPath: z.string().min(1).optional(),
    jobConcurrency: z.coerce.number().int().min(1).max(5).default(1),
  })
  .parse({
    redisUrl: process.env['REDIS_URL'],
    headed: process.env['HEADED'],
    browserPath: process.env['BROWSER_PATH'],
    jobConcurrency: process.env['JOB_CONCURRENCY'],
  });

const logger = new ConsoleLoggerAdapter(
  parseLogLevel(process.env['LOG_LEVEL'], 'verbose'),
  'price-fetcher',
);

const options = new ChromiumOptionsFactory();
logger.info(`Launching Chromium (${env.headed ? 'with a window' : 'headless'})`);
const browser = await chromium.launch({
  ...options.launch({
    headed: env.headed,
    timeoutMs: 30_000,
    ...(env.browserPath === undefined ? {} : { executablePath: env.browserPath }),
  }),
  // The runner closes the browser on a signal, after the job in progress.
  handleSIGINT: false,
  handleSIGTERM: false,
});
logger.info(`Chromium ${browser.version()} is running`);

let stopping = false;
browser.on('disconnected', (): void => {
  // Let the supervisor restart the worker instead of failing every job.
  if (stopping) return;

  logger.error('The browser disconnected; exiting');
  process.exit(1);
});

const runner = new QueueWorkerRunner<PriceFetchResultType>(
  {
    redisUrl: env.redisUrl,
    jobsQueue: queueNames.priceFetchJobs,
    resultsQueue: queueNames.priceFetchResults,
    concurrency: env.jobConcurrency,
  },
  logger,
);
const publish = (message: PriceFetchResultType): Promise<void> => runner.publish(message);

const expandRunner = new QueueWorkerRunner<never>(
  { redisUrl: env.redisUrl, jobsQueue: queueNames.linkExpandJobs, concurrency: env.jobConcurrency },
  logger,
);

const references = new OzonReferenceParser();
const dnsReferences = new DnsReferenceParser();
const parsers: OzonReaderParsersInterface = {
  geoIp: new GeoIpPageParser(),
  pages: new OzonPageParser(),
  challenges: new OzonChallengeParser(),
  products: new OzonProductParser(references),
};
const controller = new PriceFetchController(
  new FetchPricesUseCase(
    new ResolveProductReferenceUseCase([references, dnsReferences]),
    (routes) => new InMemorySessionStoreAdapter(routes),
    (sessions, timeoutMs) =>
      new MarketplaceProductReaderAdapter({
        ozon: new OzonPlaywrightProductReaderAdapter(
          browser,
          options,
          parsers,
          timeoutMs,
          sessions,
          logger.child('ozon'),
        ),
        dns: new DnsPlaywrightProductReaderAdapter(
          browser,
          options,
          {
            geoIp: parsers.geoIp,
            pages: new DnsPageParser(),
            products: new DnsProductParser(dnsReferences),
            cities: new DnsCityCookieParser(),
          },
          timeoutMs,
          logger.child('dns'),
        ),
      }),
    logger.child('prices'),
  ),
  new QueueMessageParser(logger.child('controller')),
  new JobLifecycleReporter(publish, logger.child('controller')),
  publish,
  logger.child('controller'),
);

const expandController = new LinkExpandController(
  new ExpandLinkUseCase(
    new OzonShortLinkParser(),
    new ResolveProductReferenceUseCase([references]),
    (routes) => new InMemorySessionStoreAdapter(routes),
    (sessions, timeoutMs) =>
      new OzonPlaywrightLinkExpanderAdapter(
        browser,
        options,
        timeoutMs,
        sessions,
        logger.child('ozon'),
      ),
    logger.child('links'),
  ),
  new QueueMessageParser(logger.child('links')),
  logger.child('links'),
);

expandRunner.start((data, signal): Promise<unknown> => expandController.handle(data, signal));
runner.start((data, signal, willRetry): Promise<void> =>
  controller.handle(data, signal, willRetry),
);
runner.stopOnSignals(async (): Promise<void> => {
  stopping = true;
  await expandRunner.close();
  await browser.close();
});
