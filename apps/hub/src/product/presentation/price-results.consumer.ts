import { Inject, Injectable } from '@nestjs/common';
import { priceFetchResultSchema, type PriceFetchResultType, queueNames } from 'queue-contract';
import { QueueMessageParser } from 'queue-worker';

import { RecordSessionEventUseCase } from '../../browser-session/application/index.js';
import { RecordJobMessageUseCase } from '../../job/application/index.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../../shared/application/logger.port.js';
import { ResultsConsumer } from '../../shared/presentation/results.consumer.js';
import {
  type PriceResultInterface,
  RecordPriceResultUseCase,
} from '../application/record-price-result.use-case.js';

type ProductResultType = Extract<PriceFetchResultType, { type: 'product_result' }>;

@Injectable()
export class PriceResultsConsumer extends ResultsConsumer<PriceFetchResultType> {
  constructor(
    @Inject(RecordPriceResultUseCase) private readonly recordResult: RecordPriceResultUseCase,
    @Inject(RecordJobMessageUseCase) private readonly recordJobMessage: RecordJobMessageUseCase,
    @Inject(RecordSessionEventUseCase)
    private readonly recordSessionEvent: RecordSessionEventUseCase,
    @Inject(QueueMessageParser) messages: QueueMessageParser,
    @Inject(APP_CONFIG) config: AppConfigInterface,
    @Inject(LOGGER) logger: LoggerPort,
  ) {
    super(
      {
        name: queueNames.priceFetchResults,
        schema: priceFetchResultSchema,
        description: 'price fetch result',
      },
      messages,
      config,
      logger,
    );
  }

  protected override async record(message: PriceFetchResultType, at: Date): Promise<void> {
    switch (message.type) {
      case 'job_started':
      case 'job_progress':
      case 'job_done':
      case 'job_failed':
        return this.recordJobMessage.execute(message, at);
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
        imageUrl: snapshot.imageUrl ?? null,
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
