import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { ConsoleLoggerAdapter, parseLogLevel } from 'logger';
import { queueNames } from 'queue-contract';
import { z } from 'zod';

import { RefreshProxySourceUseCase } from './application/refresh-proxy-source.use-case.js';
import { GeoIpProxyProbeAdapter } from './infrastructure/geo-ip-proxy-probe.adapter.js';
import { GithubFreeProxyListSourceAdapter } from './infrastructure/github-free-proxy-list-source.adapter.js';
import {
  InvalidProxyFetchJobError,
  ProxyFetchController,
} from './presentation/proxy-fetch.controller.js';

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

const connection = { url: env.redisUrl };
const results = new Queue(queueNames.proxyFetchResults, {
  connection,
  defaultJobOptions: { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
});
results.on('error', (error): void => {
  logger.error(`Results queue error: ${error.message}`);
});
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
  async (message): Promise<void> => {
    logger.verbose(`Publishing ${message.type} of job ${message.jobId}`);
    await results.add(message.type, message);
  },
  logger.child('controller'),
);

const worker = new Worker(
  queueNames.proxyFetchJobs,
  async (job, _token, signal): Promise<void> => {
    // The queue redelivers a failed job until its attempts are used up.
    const willRetry = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    logger.debug(`Took job ${job.id ?? '?'} (attempt ${String(job.attemptsMade + 1)})`);
    try {
      await controller.handle(job.data, signal ?? new AbortController().signal, willRetry);
    } catch (error: unknown) {
      // Retrying a malformed message cannot fix it.
      if (error instanceof InvalidProxyFetchJobError) throw new UnrecoverableError(error.message);
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
  `Waiting for jobs on ${queueNames.proxyFetchJobs} (redis ${env.redisUrl.replace(/\/\/[^@]*@/, '//***@')})`,
);

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down');
  await worker.close();
  await results.close();
};
process.once('SIGINT', (): void => {
  void shutdown();
});
process.once('SIGTERM', (): void => {
  void shutdown();
});
