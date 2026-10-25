import { Module } from '@nestjs/common';

import { JOB_QUEUE, type JobQueuePort } from '../application/job/job-queue.port.js';
import type { LoggerPort } from '../application/shared/logger.port.js';
import { LOGGER } from '../application/shared/logger.port.js';
import { BullmqJobQueueAdapter } from '../infrastructure/job/bullmq-job-queue.adapter.js';
import {
  APP_CONFIG,
  type AppConfigInterface,
} from '../infrastructure/shared/app-config.interface.js';

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
