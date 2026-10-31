import { silentLogger } from 'logger';
import {
  priceFetchJobSchema,
  type PriceFetchJobType,
  type PriceFetchResultType,
  queueNames,
} from 'queue-contract';
import { JobLifecycleReporter, QueueMessageParser, QueueWorkerRunner } from 'queue-worker';

/**
 * The worker that reads the prices, with the one part a test cannot run, the browser that opens the
 * marketplace, replaced by a table of prices. The queues, the messages and their lifecycle are the real
 * ones of the `queue-worker` package: the hub talks to it over a real Redis, as it does to the real one.
 */
export class FakePriceWorkerAdapter {
  /** Every job the worker took, in order. */
  readonly jobs: PriceFetchJobType[] = [];
  /** What each product costs, by its URL; a product not in it is not on sale. */
  private readonly prices = new Map<string, number>();
  /** The picture of each product, by its URL; a product not in it has none on its page. */
  private readonly images = new Map<string, string>();
  private readonly runner: QueueWorkerRunner<PriceFetchResultType>;
  private readonly lifecycle: JobLifecycleReporter;
  private readonly messages = new QueueMessageParser(silentLogger);

  constructor(redisUrl: string) {
    this.runner = new QueueWorkerRunner<PriceFetchResultType>(
      {
        redisUrl,
        jobsQueue: queueNames.priceFetchJobs,
        resultsQueue: queueNames.priceFetchResults,
        concurrency: 1,
      },
      silentLogger,
    );
    this.lifecycle = new JobLifecycleReporter(
      (message): Promise<void> => this.runner.publish(message),
      silentLogger,
    );
  }

  setPrice(url: string, amountMinor: number): void {
    this.prices.set(url, amountMinor);
  }

  setImage(url: string, imageUrl: string): void {
    this.images.set(url, imageUrl);
  }

  start(): void {
    this.runner.start((data, _signal, willRetry): Promise<void> => this.handle(data, willRetry));
  }

  async stop(): Promise<void> {
    await this.runner.close();
  }

  private async handle(data: unknown, willRetry: boolean): Promise<void> {
    const job = this.messages.parse(priceFetchJobSchema, data, 'price fetch job');
    this.jobs.push(job);

    await this.lifecycle.run(job.jobId, willRetry, async (): Promise<void> => {
      let succeeded = 0;
      for (const [index, product] of job.products.entries()) {
        const amountMinor = this.prices.get(product.url);
        const route = job.proxies[0];
        if (amountMinor !== undefined) succeeded += 1;

        await this.runner.publish({
          type: 'product_result',
          jobId: job.jobId,
          trackedProductId: product.trackedProductId,
          status: amountMinor === undefined ? 'parse_error' : 'success',
          attempts: [
            {
              proxy: route?.server ?? null,
              result:
                amountMinor === undefined
                  ? { status: 'parse_error' }
                  : {
                      status: 'success',
                      exitIp: '217.71.230.1',
                      snapshot: {
                        title: `Product ${product.url}`,
                        observedAt: new Date().toISOString(),
                        prices: [{ amountMinor, currency: 'RUB' }],
                        availability: 'in_stock',
                        imageUrl: this.images.get(product.url) ?? null,
                      },
                    },
            },
          ],
        });
        await this.runner.publish({
          type: 'job_progress',
          jobId: job.jobId,
          processed: index + 1,
          total: job.products.length,
          succeeded,
        });
      }
    });
  }
}
