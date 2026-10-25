import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { proxyFetchResultSchema, queueNames } from 'queue-contract';

import { RecordJobEventUseCase } from '../../application/job/record-job-event.use-case.js';
import { RecordProxyChecksUseCase } from '../../application/proxy/record-proxy-checks.use-case.js';
import { LOGGER, type LoggerPort } from '../../application/shared/logger.port.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../infrastructure/shared/app-config.interface.js';

@Injectable()
export class ProxyResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker: Worker | null = null;

  constructor(
    @Inject(RecordProxyChecksUseCase) private readonly recordChecks: RecordProxyChecksUseCase,
    @Inject(RecordJobEventUseCase) private readonly recordJobEvent: RecordJobEventUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfigInterface,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    // One at a time: a batch updates counters of proxies by reading them first.
    this.worker = new Worker(queueNames.proxyFetchResults, (job) => this.handle(job.data), {
      connection: { url: this.config.redisUrl },
      concurrency: 1,
    });
    this.worker.on('error', (error): void => {
      this.logger.error(`Queue ${queueNames.proxyFetchResults} error: ${error.message}`);
    });

    this.logger.info(`Consuming ${queueNames.proxyFetchResults}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  async handle(data: unknown): Promise<void> {
    const parsed = proxyFetchResultSchema.safeParse(data);
    // Redelivering a malformed message cannot fix it.
    if (!parsed.success) {
      this.logger.warn(
        `Dropping a malformed proxy fetch result: ${parsed.error.message.slice(0, 200)}`,
      );
      throw new UnrecoverableError('Malformed proxy fetch result');
    }

    const message = parsed.data;
    const at = new Date();
    this.logger.verbose(`Result ${message.type} of job ${message.jobId}`);

    switch (message.type) {
      case 'job_started':
        return this.recordJobEvent.execute({ type: 'started', jobId: message.jobId, at });
      case 'job_progress':
        return this.recordJobEvent.execute({
          type: 'progress',
          jobId: message.jobId,
          at,
          progress: {
            processed: message.processed,
            total: message.total,
            succeeded: message.succeeded,
          },
        });
      case 'job_done':
        return this.recordJobEvent.execute({ type: 'completed', jobId: message.jobId, at });
      case 'job_failed':
        return this.recordJobEvent.execute({
          type: 'failed',
          jobId: message.jobId,
          at,
          reason: message.reason,
          willRetry: message.willRetry,
        });
      case 'proxy_checks':
        return this.recordChecks.execute(
          message.checks.map((check) => ({
            server: check.server,
            source: message.source,
            alive: check.alive,
            latencyMs: check.latencyMs,
            country: check.country,
            exitIp: check.exitIp,
            checkedAt: new Date(check.checkedAt),
          })),
        );
    }
  }
}
