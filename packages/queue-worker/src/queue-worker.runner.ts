import { Queue, Worker } from 'bullmq';
import type { LoggerPort } from 'logger';

export interface QueueWorkerSettingsInterface {
  redisUrl: string;
  jobsQueue: string;
  resultsQueue: string;
  /** Jobs handled in parallel. */
  concurrency: number;
}

/** Handles a raw job message; `willRetry` tells whether the queue delivers the job again after a failure. */
export type JobHandlerType = (
  data: unknown,
  signal: AbortSignal,
  willRetry: boolean,
) => Promise<void>;

/** Takes the jobs of one queue and publishes their results to another one. */
export class QueueWorkerRunner<ResultType extends { type: string; jobId: string }> {
  private readonly connection: { url: string };
  private readonly results: Queue;
  private worker: Worker | null = null;

  constructor(
    private readonly settings: QueueWorkerSettingsInterface,
    private readonly logger: LoggerPort,
  ) {
    this.connection = { url: settings.redisUrl };
    this.results = new Queue(settings.resultsQueue, {
      connection: this.connection,
      defaultJobOptions: { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 } },
    });
    this.results.on('error', (error): void => {
      this.logger.error(`Results queue error: ${error.message}`);
    });
  }

  async publish(message: ResultType): Promise<void> {
    this.logger.verbose(`Publishing ${message.type} of job ${message.jobId}`);
    await this.results.add(message.type, message);
  }

  start(handle: JobHandlerType): void {
    this.worker = new Worker(
      this.settings.jobsQueue,
      async (job, _token, signal): Promise<void> => {
        // The queue redelivers a failed job until its attempts are used up.
        const willRetry = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
        this.logger.debug(`Took job ${job.id ?? '?'} (attempt ${String(job.attemptsMade + 1)})`);

        await handle(job.data, signal ?? new AbortController().signal, willRetry);
      },
      { connection: this.connection, concurrency: this.settings.concurrency },
    );

    this.worker.on('error', (error): void => {
      this.logger.error(`Worker error: ${error.message}`);
    });
    this.worker.on('failed', (job, error): void => {
      this.logger.warn(`Queue job ${job?.id ?? '?'} failed: ${error.message}`);
    });

    this.logger.info(
      `Waiting for jobs on ${this.settings.jobsQueue} (redis ${this.settings.redisUrl.replace(/\/\/[^@]*@/, '//***@')})`,
    );
  }

  /** Stops taking jobs, lets the one in progress finish, and closes the queues. */
  async close(): Promise<void> {
    await this.worker?.close();
    await this.results.close();
  }

  /** Stops taking jobs on SIGINT or SIGTERM, then releases the other resources with `cleanup`. */
  stopOnSignals(cleanup: () => Promise<void> = (): Promise<void> => Promise.resolve()): void {
    const stop = async (): Promise<void> => {
      this.logger.info('Shutting down');
      await this.close();
      await cleanup();
    };

    process.once('SIGINT', (): void => {
      void stop();
    });
    process.once('SIGTERM', (): void => {
      void stop();
    });
  }
}
