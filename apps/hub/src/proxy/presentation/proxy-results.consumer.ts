import { Inject, Injectable } from '@nestjs/common';
import { proxyFetchResultSchema, type ProxyFetchResultType, queueNames } from 'queue-contract';
import { QueueMessageParser } from 'queue-worker';

import { RecordJobEventUseCase } from '../../job/application/record-job-event.use-case.js';
import { LOGGER, type LoggerPort } from '../../shared/application/logger.port.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/infrastructure/app-config.interface.js';
import { ResultsConsumer } from '../../shared/presentation/results.consumer.js';
import { RecordProxyChecksUseCase } from '../application/record-proxy-checks.use-case.js';

@Injectable()
export class ProxyResultsConsumer extends ResultsConsumer<ProxyFetchResultType> {
  constructor(
    @Inject(RecordProxyChecksUseCase) private readonly recordChecks: RecordProxyChecksUseCase,
    @Inject(RecordJobEventUseCase) recordJobEvent: RecordJobEventUseCase,
    @Inject(QueueMessageParser) messages: QueueMessageParser,
    @Inject(APP_CONFIG) config: AppConfigInterface,
    @Inject(LOGGER) logger: LoggerPort,
  ) {
    super(
      {
        name: queueNames.proxyFetchResults,
        schema: proxyFetchResultSchema,
        description: 'proxy fetch result',
      },
      recordJobEvent,
      messages,
      config,
      logger,
    );
  }

  protected override record(message: ProxyFetchResultType, at: Date): Promise<void> {
    switch (message.type) {
      case 'job_started':
      case 'job_progress':
      case 'job_done':
      case 'job_failed':
        return this.recordJobMessage(message, at);
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
