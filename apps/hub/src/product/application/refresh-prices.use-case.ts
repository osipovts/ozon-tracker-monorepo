import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { MarketplaceType } from 'product-reference';

import type { ScheduleJobUseCase } from '../../job/application/index.js';
import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import type { ChoosePriceRoutesUseCase } from './choose-price-routes.use-case.js';
import type {
  PriceJobSlotInterface,
  SpreadPriceJobsUseCase,
} from './spread-price-jobs.use-case.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

/** What a job of the price worker takes: the contract of the queue allows 50 products to a job. */
const productsPerJob = 50;

export interface PriceRefreshSettingsInterface {
  /** A price is read again once it is this old. */
  refreshAfterMs: number;
  /** How many products one run queues at most: the rest wait for the next run. */
  batchSize: number;
  timeoutMs: number;
}

export interface PriceRefreshResultInterface {
  products: number;
  jobs: number;
}

/**
 * Queues the read of the tracked products whose price is stale, for the schedule: the products nobody
 * tracks are left alone. A product stays due until a job for it is queued, so a run that finds no route,
 * or a queue that is down, is made up for by the next one. The jobs of a marketplace are spread over its
 * proxies and over time, so that no proxy gets many of them at once.
 */
export class RefreshPricesUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly chooseRoutes: Pick<ChoosePriceRoutesUseCase, 'execute'>,
    private readonly scheduleJob: ScheduleJobUseCase,
    private readonly spread: Pick<SpreadPriceJobsUseCase, 'execute'>,
    private readonly settings: PriceRefreshSettingsInterface,
    private readonly clock: ClockPort = systemClock,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(): Promise<PriceRefreshResultInterface> {
    const now = this.clock.now();
    const due = await this.products.listDueForRefresh(
      new Date(now.getTime() - this.settings.refreshAfterMs),
      this.settings.batchSize,
    );

    const result = { products: 0, jobs: 0 };
    for (const [marketplace, group] of this.byMarketplace(due)) {
      const routes = await this.chooseRoutes.execute(marketplace);
      if (routes.length === 0) {
        this.logger.warn(`No route to ${marketplace}: ${String(group.length)} prices wait`);
        continue;
      }

      for (let from = 0; from < group.length; from += productsPerJob) {
        const queued = await this.queue(
          marketplace,
          group.slice(from, from + productsPerJob),
          this.spread.execute(marketplace, routes, now),
          now,
        );
        result.products += queued;
        result.jobs += queued > 0 ? 1 : 0;
      }
    }

    return result;
  }

  private byMarketplace(due: TrackedProductEntity[]): Map<MarketplaceType, TrackedProductEntity[]> {
    const groups = new Map<MarketplaceType, TrackedProductEntity[]>();
    for (const product of due) {
      const group = groups.get(product.snapshot.marketplace) ?? [];
      group.push(product);
      groups.set(product.snapshot.marketplace, group);
    }

    return groups;
  }

  /** Tells how many products it queued: none if the job was refused, and those are due again next time. */
  private async queue(
    marketplace: MarketplaceType,
    chunk: TrackedProductEntity[],
    slot: PriceJobSlotInterface,
    now: Date,
  ): Promise<number> {
    try {
      await this.scheduleJob.execute({
        kind: 'price_fetch',
        requestedBy: null,
        subject: marketplace,
        routes: slot.routes,
        delayMs: slot.delayMs,
        products: chunk.map(({ readRequest }) => readRequest),
        timeoutMs: this.settings.timeoutMs,
      });
      await this.products.markRequested(
        chunk.map(({ snapshot }): string => snapshot.id),
        now,
      );

      return chunk.length;
    } catch (error: unknown) {
      this.logger.warn(
        `A price refresh of ${String(chunk.length)} products was not queued: ${errorMessage(error)}`,
      );

      return 0;
    }
  }
}
