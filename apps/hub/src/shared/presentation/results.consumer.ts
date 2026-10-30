import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { QueueMessageParser } from 'queue-worker';
import type { z } from 'zod';

import type { AppConfigInterface } from '../application/app-config.interface.js';
import type { LoggerPort } from '../application/logger.port.js';

export interface ResultsQueueInterface<MessageType> {
  name: string;
  schema: z.ZodType<MessageType>;
  /** What a message is, for the logs. */
  description: string;
}

/** Consumes the results a worker publishes, one at a time: recording one reads what it updates. */
export abstract class ResultsConsumer<MessageType extends { type: string; jobId: string }>
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private worker: Worker | null = null;

  protected constructor(
    private readonly queue: ResultsQueueInterface<MessageType>,
    private readonly messages: QueueMessageParser,
    private readonly config: AppConfigInterface,
    protected readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker(this.queue.name, (job) => this.handle(job.data), {
      connection: { url: this.config.redisUrl },
      concurrency: 1,
    });
    this.worker.on('error', (error): void => {
      this.logger.error(`Queue ${this.queue.name} error: ${error.message}`);
    });

    this.logger.info(`Consuming ${this.queue.name}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  async handle(data: unknown): Promise<void> {
    const message = this.messages.parse(this.queue.schema, data, this.queue.description);
    this.logger.verbose(`Result ${message.type} of job ${message.jobId}`);

    await this.record(message, new Date());
  }

  protected abstract record(message: MessageType, at: Date): Promise<void>;
}
