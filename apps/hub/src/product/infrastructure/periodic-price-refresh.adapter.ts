import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';

export interface PeriodicPriceRefreshSettingsInterface {
  /** How often the hub looks for the prices that are old enough to be read again. */
  pollMs: number;
  /** 0 turns the refresh off. */
  refreshAfterMs: number;
}

/**
 * Looks for the prices that are old enough on every poll, and queues their read. When the hub starts it
 * catches up at once: everything that fell due while it was down is queued, a batch after a batch, since
 * the products are due by their own last read and not by a slot of the clock that a downtime could miss.
 * Of the instances of the hub that share a Redis, only the first to reach a poll runs it: the window is a
 * little shorter than the poll, so a slow instance cannot run it a second time.
 */
export class PeriodicPriceRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly refresh: Pick<RefreshPricesUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly settings: PeriodicPriceRefreshSettingsInterface,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    if (this.settings.refreshAfterMs <= 0) {
      this.logger.info('The refresh of the prices is off (PRICE_REFRESH_AFTER_MS is 0)');

      return;
    }

    void this.run(true);
    this.timer = setInterval((): void => {
      void this.run(false);
    }, this.settings.pollMs);
    this.timer.unref();
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  /** `catchUp` queues everything that is due, not just a batch. */
  private async run(catchUp: boolean): Promise<void> {
    if (this.running) return;

    this.running = true;
    try {
      const turn = await this.limiter.hit('price-refresh:run', {
        limit: 1,
        windowMs: Math.floor(this.settings.pollMs * 0.9),
      });
      if (!turn.allowed) return;

      let products = 0;
      let jobs = 0;
      let queued = 0;
      do {
        const batch = await this.refresh.execute();
        queued = batch.products;
        products += batch.products;
        jobs += batch.jobs;
      } while (catchUp && queued > 0);

      if (products > 0) {
        this.logger.info(
          `Queued the refresh of ${String(products)} prices in ${String(jobs)} jobs`,
        );
      }
    } catch (error: unknown) {
      this.logger.warn(`The refresh of the prices failed: ${errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }
}
