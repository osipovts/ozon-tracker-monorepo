import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import {
  nextHourlyRunAfter,
  type PriceRefreshScheduleType,
  schedulePeriodMs,
} from '../application/price-refresh-schedule.type.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';

/**
 * Runs the refresh of the stale prices on its schedule: when the hub starts and then every interval, or at
 * a minute of every hour (UTC), and not at the start, since a restart is no reason to read every price a
 * second time within the hour; a schedule that is off leaves it off. Of the instances of the hub that
 * share a Redis, only the first to reach a window runs it: the window is a little shorter than the
 * period, so a slow instance cannot run it a second time.
 */
export class PeriodicPriceRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshPricesUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly schedule: PriceRefreshScheduleType,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    if (this.schedule.kind === 'off') {
      this.logger.info('The refresh of the prices is off (PRICE_REFRESH_INTERVAL_MS is 0)');

      return;
    }

    if (this.schedule.kind === 'interval') {
      void this.run();
      this.timer = setInterval((): void => {
        void this.run();
      }, this.schedule.intervalMs);
      this.timer.unref();
    } else {
      this.armHourly(this.schedule.minute, nextHourlyRunAfter(this.schedule.minute, new Date()));
    }
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  /** Waits for the run at `slot`, and arms the next one from the slot, so that a timer that fires early cannot run twice. */
  private armHourly(minute: number, slot: Date): void {
    this.logger.info(`The next refresh of the prices is at ${slot.toISOString()}`);
    this.timer = setTimeout(
      (): void => {
        void this.run();
        this.armHourly(
          minute,
          nextHourlyRunAfter(minute, new Date(Math.max(slot.getTime(), Date.now()))),
        );
      },
      Math.max(slot.getTime() - Date.now(), 0),
    );
    this.timer.unref();
  }

  private async run(): Promise<void> {
    try {
      const turn = await this.limiter.hit('price-refresh:run', {
        limit: 1,
        windowMs: Math.floor(schedulePeriodMs(this.schedule) * 0.9),
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
