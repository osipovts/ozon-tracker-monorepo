import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { type HandbookFetchResultType, queueNames } from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser, QueueWorkerRunner } from 'queue-worker';
import { z } from 'zod';

import { FetchCitiesUseCase } from './application/fetch-cities.use-case.js';
import { DnsCitiesByLetterSourceAdapter } from './infrastructure/dns-cities-by-letter-source.adapter.js';
import { HandbookFetchController } from './presentation/handbook-fetch.controller.js';

const env = z
  .object({
    redisUrl: z.string().default('redis://localhost:6379'),
    jobConcurrency: z.coerce.number().int().min(1).max(5).default(1),
  })
  .parse({
    redisUrl: process.env['REDIS_URL'],
    jobConcurrency: process.env['JOB_CONCURRENCY'],
  });
const logger = new ConsoleLoggerAdapter(
  parseLogLevel(process.env['LOG_LEVEL'], 'verbose'),
  'handbook-fetcher',
);

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
      new DnsCitiesByLetterSourceAdapter(),
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
runner.stopOnSignals();
