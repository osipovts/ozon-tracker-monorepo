import { Module } from '@nestjs/common';

import { JOB_QUEUE, type JobQueuePort } from '../job/application/job-queue.port.js';
import { BullmqJobQueueAdapter } from '../job/infrastructure/bullmq-job-queue.adapter.js';
import type { LoggerPort } from '../shared/application/logger.port.js';
import { LOGGER } from '../shared/application/logger.port.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../shared/infrastructure/app-config.interface.js';

/** The queues the jobs of the workers are published to. */
@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      useFactory: (config: AppConfigInterface, logger: LoggerPort): JobQueuePort =>
        new BullmqJobQueueAdapter(config.redisUrl, logger.child('queue')),
      inject: [APP_CONFIG, LOGGER],
    },
  ],
  exports: [JOB_QUEUE],
})
export class QueueModule {}
