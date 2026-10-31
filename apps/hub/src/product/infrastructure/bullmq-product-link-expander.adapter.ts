import { Queue, QueueEvents } from 'bullmq';
import { type LoggerPort, silentLogger } from 'logger';
import { linkExpandJobSchema, linkExpandResultSchema, queueNames } from 'queue-contract';

import type {
  ProductLinkExpanderPort,
  ProductLinkExpansionInterface,
} from '../application/product-link-expander.port.js';

/** Asks a worker to follow the short link and waits for the answer: the worker returns it as the result of the job. */
export class BullmqProductLinkExpanderAdapter implements ProductLinkExpanderPort {
  private readonly queue: Queue;
  private readonly events: QueueEvents;

  constructor(
    redisUrl: string,
    private readonly logger: LoggerPort = silentLogger,
  ) {
    const connection = { url: redisUrl };
    this.queue = new Queue(queueNames.linkExpandJobs, { connection });
    this.events = new QueueEvents(queueNames.linkExpandJobs, { connection });

    const report = (error: Error): void => {
      this.logger.error(`Queue ${queueNames.linkExpandJobs} error: ${error.message}`);
    };
    this.queue.on('error', report);
    this.events.on('error', report);
  }

  async expand(request: ProductLinkExpansionInterface): Promise<string> {
    const data = linkExpandJobSchema.parse({
      url: request.url,
      proxies: request.routes.map((route) => ({
        server: route.server,
        ...(route.session === null ? {} : { session: route.session }),
      })),
      timeoutMs: request.timeoutMs,
    });
    const job = await this.queue.add('link-expand', data, {
      attempts: 1,
      removeOnComplete: { age: 600 },
      removeOnFail: { age: 3600 },
    });

    // The worker tries every route, one after another, each for up to the timeout.
    const result = linkExpandResultSchema.parse(
      await job.waitUntilFinished(this.events, request.timeoutMs * data.proxies.length + 5000),
    );
    this.logger.debug(`Expanded a short link to ${result.url}`);

    return result.url;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.queue.close(), this.events.close()]);
  }
}
