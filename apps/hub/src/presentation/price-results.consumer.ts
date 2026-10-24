import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { priceFetchResultSchema, type PriceFetchResultType, queueNames } from 'queue-contract';

import { LOGGER, type LoggerPort } from '../application/logger.port.js';
import { RecordJobEventUseCase } from '../application/record-job-event.use-case.js';
import {
  type PriceResultInterface,
  RecordPriceResultUseCase,
} from '../application/record-price-result.use-case.js';
import { RecordSessionEventUseCase } from '../application/record-session-event.use-case.js';
import { APP_CONFIG, type AppConfigInterface } from '../infrastructure/app-config.interface.js';

type ProductResultType = Extract<PriceFetchResultType, { type: 'product_result' }>;

@Injectable()
export class PriceResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker: Worker | null = null;

  constructor(
    @Inject(RecordPriceResultUseCase) private readonly recordResult: RecordPriceResultUseCase,
    @Inject(RecordJobEventUseCase) private readonly recordJobEvent: RecordJobEventUseCase,
    @Inject(RecordSessionEventUseCase)
    private readonly recordSessionEvent: RecordSessionEventUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfigInterface,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker(queueNames.priceFetchResults, (job) => this.handle(job.data), {
      connection: { url: this.config.redisUrl },
    });
    this.worker.on('error', (error): void => {
      this.logger.error(`Queue ${queueNames.priceFetchResults} error: ${error.message}`);
    });
    this.logger.info(`Consuming ${queueNames.priceFetchResults}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  async handle(data: unknown): Promise<void> {
    const parsed = priceFetchResultSchema.safeParse(data);
    // Redelivering a malformed message cannot fix it.
    if (!parsed.success) {
      this.logger.warn(
        `Dropping a malformed price fetch result: ${parsed.error.message.slice(0, 200)}`,
      );
      throw new UnrecoverableError('Malformed price fetch result');
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
            percent: message.percent,
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
      case 'product_result':
        await this.recordResult.execute(this.toResult(message));
        await this.recordSessionOutcomes(message, at);
        return;
      case 'session_update':
        return this.recordSessionEvent.execute({
          type: 'refreshed',
          sessionId: message.sessionId,
          at,
          storageState: message.storageState,
        });
      case 'session_ip_mismatch':
        this.logger.warn(
          `Session ${message.sessionId} was created at ${message.expectedIp}, but the route exits at ${message.actualIp}`,
        );
        return this.recordSessionEvent.execute({
          type: 'stale',
          sessionId: message.sessionId,
          at,
          reason: 'ip_mismatch',
        });
    }
  }

  /** A challenge despite a session makes it stale; a read makes it used. */
  private async recordSessionOutcomes(message: ProductResultType, at: Date): Promise<void> {
    for (const attempt of message.attempts) {
      if (attempt.sessionId === undefined) continue;
      if (attempt.result.status === 'challenge_required')
        await this.recordSessionEvent.execute({
          type: 'stale',
          sessionId: attempt.sessionId,
          at,
          reason: 'challenge_required',
        });
      else if (attempt.result.status === 'success' || attempt.result.status === 'partial')
        await this.recordSessionEvent.execute({ type: 'used', sessionId: attempt.sessionId, at });
    }
  }

  private toResult(message: ProductResultType): PriceResultInterface {
    for (const attempt of message.attempts) {
      if (!('snapshot' in attempt.result)) continue;
      const { snapshot, exitIp } = attempt.result;
      return {
        jobId: message.jobId,
        trackedProductId: message.trackedProductId,
        status: message.status,
        observation: {
          title: snapshot.title,
          observedAt: new Date(snapshot.observedAt),
          availability: snapshot.availability,
          prices: snapshot.prices,
          exitIp,
        },
      };
    }
    return {
      jobId: message.jobId,
      trackedProductId: message.trackedProductId,
      status: message.status,
      observation: null,
    };
  }
}
