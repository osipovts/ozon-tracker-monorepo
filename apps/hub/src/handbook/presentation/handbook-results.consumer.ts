import { Inject, Injectable } from '@nestjs/common';
import {
  handbookFetchResultSchema,
  type HandbookFetchResultType,
  queueNames,
} from 'queue-contract';
import { QueueMessageParser } from 'queue-worker';

import { RecordJobMessageUseCase } from '../../job/application/index.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../../shared/application/logger.port.js';
import { ResultsConsumer } from '../../shared/presentation/results.consumer.js';
import { SaveHandbookCitiesUseCase } from '../application/save-handbook-cities.use-case.js';

@Injectable()
export class HandbookResultsConsumer extends ResultsConsumer<HandbookFetchResultType> {
  constructor(
    @Inject(SaveHandbookCitiesUseCase) private readonly saveCities: SaveHandbookCitiesUseCase,
    @Inject(RecordJobMessageUseCase) private readonly recordJobMessage: RecordJobMessageUseCase,
    @Inject(QueueMessageParser) messages: QueueMessageParser,
    @Inject(APP_CONFIG) config: AppConfigInterface,
    @Inject(LOGGER) logger: LoggerPort,
  ) {
    super(
      {
        name: queueNames.handbookFetchResults,
        schema: handbookFetchResultSchema,
        description: 'handbook fetch result',
      },
      messages,
      config,
      logger,
    );
  }

  protected override record(message: HandbookFetchResultType, at: Date): Promise<void> {
    switch (message.type) {
      case 'job_started':
      case 'job_progress':
      case 'job_done':
      case 'job_failed':
        return this.recordJobMessage.execute(message, at);
      case 'handbook_cities':
        return this.saveCities.execute(message.handbook, message.cities);
    }
  }
}
