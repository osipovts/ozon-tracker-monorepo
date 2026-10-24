import { type JobsOptions, Queue } from 'bullmq';
import { type LoggerPort, silentLogger } from 'logger';
import {
  priceFetchJobSchema,
  type PriceFetchJobType,
  proxyFetchJobSchema,
  type ProxyFetchJobType,
  queueNames,
} from 'queue-contract';

import type {
  JobQueuePort,
  PriceFetchRequestInterface,
  ProxyFetchRequestInterface,
} from '../application/job-queue.port.js';

const jobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
};

export class BullmqJobQueueAdapter implements JobQueuePort {
  private readonly proxyFetchQueue: Queue;
  private readonly priceFetchQueue: Queue;

  constructor(
    redisUrl: string,
    private readonly logger: LoggerPort = silentLogger,
  ) {
    const connection = { url: redisUrl };
    this.proxyFetchQueue = new Queue(queueNames.proxyFetchJobs, { connection });
    this.priceFetchQueue = new Queue(queueNames.priceFetchJobs, { connection });
    for (const queue of [this.proxyFetchQueue, this.priceFetchQueue]) {
      queue.on('error', (error): void => {
        this.logger.error(`Queue ${queue.name} error: ${error.message}`);
      });
    }
  }

  async enqueueProxyFetch(request: ProxyFetchRequestInterface): Promise<void> {
    const job: ProxyFetchJobType = proxyFetchJobSchema.parse({
      jobId: request.jobId,
      sources: [request.source],
      maxCandidates: request.maxCandidates,
      probeTimeoutMs: request.probeTimeoutMs,
    });
    await this.proxyFetchQueue.add('proxy-fetch', job, { ...jobOptions, jobId: job.jobId });
    this.logger.debug(`Published proxy-fetch ${job.jobId} to ${queueNames.proxyFetchJobs}`);
  }

  async enqueuePriceFetch(request: PriceFetchRequestInterface): Promise<void> {
    const job: PriceFetchJobType = priceFetchJobSchema.parse({
      jobId: request.jobId,
      proxies: request.routes.map((route) => ({
        server: route.server,
        ...(route.session === null ? {} : { session: route.session }),
      })),
      products: request.products,
      timeoutMs: request.timeoutMs,
    });
    await this.priceFetchQueue.add('price-fetch', job, { ...jobOptions, jobId: job.jobId });
    this.logger.debug(`Published price-fetch ${job.jobId} to ${queueNames.priceFetchJobs}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.proxyFetchQueue.close(), this.priceFetchQueue.close()]);
  }
}
