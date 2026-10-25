import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { chromium } from 'playwright';
import { ResolveProductReferenceUseCase } from 'product-reference';
import { OzonReferenceParser } from 'product-reference';
import { queueNames } from 'queue-contract';
import { z } from 'zod';

import { OzonPlaywrightProductReaderAdapter } from './infrastructure/ozon/ozon-playwright-product-reader.adapter.js';
import { OzonProductParser } from './infrastructure/ozon/ozon-product.parser.js';
import { MarketplaceProductReaderAdapter } from './infrastructure/product/marketplace-product-reader.adapter.js';
import { ChromiumLaunchAdapter } from './infrastructure/shared/chromium-launch.adapter.js';
import {
  InvalidPriceFetchJobError,
  PriceFetchController,
} from './presentation/product/price-fetch.controller.js';

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

logger.info(`Launching Chromium (${env.headed ? 'with a window' : 'headless'})`);
const browser = await chromium.launch(
  new ChromiumLaunchAdapter().launchOptions({
    headed: env.headed,
    timeoutMs: 30_000,
    ...(env.browserPath === undefined ? {} : { executablePath: env.browserPath }),
  }),
);

let stopping = false;
browser.on('disconnected', (): void => {
  // Let the supervisor restart the worker instead of failing every job.
  if (stopping) return;
  logger.error('The browser disconnected; exiting');
  process.exit(1);
});

const connection = { url: env.redisUrl };
const results = new Queue(queueNames.priceFetchResults, {
  connection,
  defaultJobOptions: { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
});
results.on('error', (error): void => {
  logger.error(`Results queue error: ${error.message}`);
});

const controller = new PriceFetchController(
  new ResolveProductReferenceUseCase([new OzonReferenceParser()]),
  (sessions, timeoutMs) =>
    new MarketplaceProductReaderAdapter({
      ozon: new OzonPlaywrightProductReaderAdapter(
        browser,
        new OzonProductParser(),
        timeoutMs,
        sessions,
        logger.child('ozon'),
      ),
    }),
  async (message): Promise<void> => {
    logger.verbose(`Publishing ${message.type} of job ${message.jobId}`);
    await results.add(message.type, message);
  },
  logger.child('controller'),
);

const worker = new Worker(
  queueNames.priceFetchJobs,
  async (job, _token, signal): Promise<void> => {
    // The queue redelivers a failed job until its attempts are used up.
    const willRetry = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    logger.debug(`Took job ${job.id ?? '?'} (attempt ${String(job.attemptsMade + 1)})`);

    try {
      await controller.handle(job.data, signal ?? new AbortController().signal, willRetry);
    } catch (error: unknown) {
      // Retrying a malformed message cannot fix it.
      if (error instanceof InvalidPriceFetchJobError) throw new UnrecoverableError(error.message);
      throw error;
    }
  },
  { connection, concurrency: env.jobConcurrency },
);

worker.on('error', (error): void => {
  logger.error(`Worker error: ${error.message}`);
});
worker.on('failed', (job, error): void => {
  logger.warn(`Queue job ${job?.id ?? '?'} failed: ${error.message}`);
});

logger.info(
  `Waiting for jobs on ${queueNames.priceFetchJobs} (redis ${env.redisUrl.replace(/\/\/[^@]*@/, '//***@')}, Chromium ${browser.version()})`,
);

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down');
  stopping = true;
  await worker.close();
  await results.close();
  await browser.close();
};

process.once('SIGINT', (): void => {
  void shutdown();
});
process.once('SIGTERM', (): void => {
  void shutdown();
});
