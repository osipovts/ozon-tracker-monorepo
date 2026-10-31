import { Camoufox } from 'camoufox-js';
import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { type HandbookFetchResultType, queueNames } from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser, QueueWorkerRunner } from 'queue-worker';
import { z } from 'zod';

import { FetchCitiesUseCase } from './application/fetch-cities.use-case.js';
import { CamoufoxOptionsFactory } from './infrastructure/camoufox-options.factory.js';
import { DnsBrowserCitySourceAdapter } from './infrastructure/dns-browser-city-source.adapter.js';
import { HandbookFetchController } from './presentation/handbook-fetch.controller.js';

const env = z
  .object({
    redisUrl: z.string().default('redis://localhost:6379'),
    jobConcurrency: z.coerce.number().int().min(1).max(5).default(1),
    headed: z.stringbool().default(true),
    browserPath: z.string().min(1).optional(),
    /** How long the site may take to open, and to answer, through a route. */
    timeoutMs: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  })
  .parse({
    redisUrl: process.env['REDIS_URL'],
    jobConcurrency: process.env['JOB_CONCURRENCY'],
    headed: process.env['HEADED'],
    browserPath: process.env['BROWSER_PATH'],
    timeoutMs: process.env['SITE_TIMEOUT_MS'],
  });
const logger = new ConsoleLoggerAdapter(
  parseLogLevel(process.env['LOG_LEVEL'], 'verbose'),
  'handbook-fetcher',
);

const options = new CamoufoxOptionsFactory();
logger.info(`Launching Camoufox (${env.headed ? 'with a window' : 'headless'})`);
const browser = await Camoufox({
  ...options.launch({
    headed: env.headed,
    ...(env.browserPath === undefined ? {} : { executablePath: env.browserPath }),
  }),
  // The runner closes the browser on a signal, after the job in progress.
  handleSIGINT: false,
  handleSIGTERM: false,
});
logger.info(`Firefox ${browser.version()} is running`);

let stopping = false;
browser.on('disconnected', (): void => {
  // Let the supervisor restart the worker instead of failing every job.
  if (stopping) return;

  logger.error('The browser disconnected; exiting');
  process.exit(1);
});

const runner = new QueueWorkerRunner<HandbookFetchResultType>(
  {
    redisUrl: env.redisUrl,
    jobsQueue: queueNames.handbookFetchJobs,
    resultsQueue: queueNames.handbookFetchResults,
    concurrency: env.jobConcurrency,
  },
  logger,
);
const publish = (message: HandbookFetchResultType): Promise<void> => runner.publish(message);

/** The first letters of the names of the cities. */
const russianLetters = Array.from('АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ');

const controller = new HandbookFetchController(
  {
    'dns-cities': new FetchCitiesUseCase(
      new DnsBrowserCitySourceAdapter(browser, options, env.timeoutMs, logger.child('dns-site')),
      russianLetters,
      logger.child('dns-cities'),
    ),
  },
  new QueueMessageParser(logger.child('controller')),
  new JobLifecycleReporter(publish, logger.child('controller')),
  publish,
  logger.child('controller'),
);

runner.start((data, signal, willRetry): Promise<void> =>
  controller.handle(data, signal, willRetry),
);
runner.stopOnSignals(async (): Promise<void> => {
  stopping = true;
  await browser.close();
});
