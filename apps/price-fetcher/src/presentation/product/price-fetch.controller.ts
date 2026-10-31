import { type LoggerPort, silentLogger } from 'logger';
import { priceFetchJobSchema, type PriceFetchResultType } from 'queue-contract';
import type { JobLifecycleReporter, QueueMessageParser } from 'queue-worker';

import type {
  FetchPricesListenerInterface,
  FetchPricesUseCase,
} from '../../application/product/fetch-prices.use-case.js';

export class PriceFetchController {
  constructor(
    private readonly fetchPrices: Pick<FetchPricesUseCase, 'execute'>,
    private readonly messages: QueueMessageParser,
    private readonly lifecycle: JobLifecycleReporter,
    private readonly publish: (message: PriceFetchResultType) => Promise<void>,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** `willRetry` tells whether the queue is going to deliver the job again after a failure. */
  async handle(data: unknown, signal: AbortSignal, willRetry = false): Promise<void> {
    const job = this.messages.parse(priceFetchJobSchema, data, 'price fetch job');
    this.logger.info(
      `Job ${job.jobId} started: ${String(job.products.length)} products, ${String(job.proxies.length)} routes, timeout ${String(job.timeoutMs)} ms`,
    );

    await this.lifecycle.run(job.jobId, willRetry, (): Promise<void> =>
      this.fetchPrices.execute(
        {
          routes: job.proxies,
          products: job.products,
          timeoutMs: job.timeoutMs,
        },
        signal,
        this.listenerOf(job.jobId),
      ),
    );
  }

  private listenerOf(jobId: string): FetchPricesListenerInterface {
    return {
      onProgress: (progress): Promise<void> =>
        this.publish({ type: 'job_progress', jobId, ...progress }),
      onProduct: (result): Promise<void> =>
        this.publish({ type: 'product_result', jobId, ...result }),
    };
  }
}
