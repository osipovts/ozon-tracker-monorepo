import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { type ProxyFetchResultType, queueNames } from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser, QueueWorkerRunner } from 'queue-worker';
import { z } from 'zod';

import { RefreshProxySourceUseCase } from './application/refresh-proxy-source.use-case.js';
import { GeoIpProxyProbeAdapter } from './infrastructure/geo-ip-proxy-probe.adapter.js';
import { GithubFreeProxyListSourceAdapter } from './infrastructure/github-free-proxy-list-source.adapter.js';
import { ProxyFetchController } from './presentation/proxy-fetch.controller.js';

const env = z
  .object({
    redisUrl: z.string().default('redis://localhost:6379'),
    probeConcurrency: z.coerce.number().int().min(1).max(500).default(50),
    resultBatchSize: z.coerce.number().int().min(1).max(500).default(100),
    jobConcurrency: z.coerce.number().int().min(1).max(10).default(1),
  })
  .parse({
    redisUrl: process.env['REDIS_URL'],
    probeConcurrency: process.env['PROBE_CONCURRENCY'],
    resultBatchSize: process.env['RESULT_BATCH_SIZE'],
    jobConcurrency: process.env['JOB_CONCURRENCY'],
  });
const logger = new ConsoleLoggerAdapter(
  parseLogLevel(process.env['LOG_LEVEL'], 'verbose'),
  'proxy-fetcher',
);

const runner = new QueueWorkerRunner<ProxyFetchResultType>(
  {
    redisUrl: env.redisUrl,
    jobsQueue: queueNames.proxyFetchJobs,
    resultsQueue: queueNames.proxyFetchResults,
    concurrency: env.jobConcurrency,
  },
  logger,
);
const publish = (message: ProxyFetchResultType): Promise<void> => runner.publish(message);

const controller = new ProxyFetchController(
  {
    'github-free-proxy-list': new RefreshProxySourceUseCase(
      new GithubFreeProxyListSourceAdapter(logger.child('source')),
      new GeoIpProxyProbeAdapter(undefined, logger.child('probe')),
      env.probeConcurrency,
      env.resultBatchSize,
      logger.child('refresh'),
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
