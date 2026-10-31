import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';

/**
 * Runs the refresh of the stale prices when the hub starts and then every interval; an interval of 0
 * leaves it off. Of the instances of the hub that share a Redis, only the first to reach a window runs
 * it: the window is a little shorter than the interval, so a slow instance cannot run it a second time.
 */
export class PeriodicPriceRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshPricesUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly intervalMs: number,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    if (this.intervalMs <= 0) {
      this.logger.info('The refresh of the prices is off (PRICE_REFRESH_INTERVAL_MS is 0)');

      return;
    }

    void this.run();
    this.timer = setInterval((): void => {
      void this.run();
    }, this.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  private async run(): Promise<void> {
    try {
      const turn = await this.limiter.hit('price-refresh:run', {
        limit: 1,
        windowMs: Math.floor(this.intervalMs * 0.9),
      });
      if (!turn.allowed) return;

      const { products, jobs } = await this.refresh.execute();
      if (products > 0) {
        this.logger.info(
          `Queued the refresh of ${String(products)} prices in ${String(jobs)} jobs`,
        );
      }
    } catch (error: unknown) {
      this.logger.warn(`The refresh of the prices failed: ${errorMessage(error)}`);
    }
  }
}
