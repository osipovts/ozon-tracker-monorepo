import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import {
  hourMs,
  nextHourlyRunAfter,
  type PriceRefreshScheduleType,
  schedulePeriodMs,
} from '../application/price-refresh-schedule.type.js';
import type { RefreshPricesUseCase } from '../application/refresh-prices.use-case.js';

/** How long before the next slot the window of a late run ends. */
const catchUpMarginMs = 60_000;

/**
 * Runs the refresh of the stale prices on its schedule: when the hub starts and then every interval, or at
 * a minute of every hour (UTC); a schedule that is off leaves it off. At the start of an hourly schedule the
 * refresh runs at once only if the last slot passed without one, since a restart is no reason to read every
 * price a second time within the hour: the hub that was down at the minute does not skip the hour. Of the
 * instances of the hub that share a Redis, only the first to reach a window runs it: the window is a little
 * shorter than the period, so a slow instance cannot run it a second time.
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
      const now = new Date();
      const next = nextHourlyRunAfter(this.schedule.minute, now);
      this.catchUpHourly(now, next);
      this.armHourly(this.schedule.minute, next);
    }
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  /**
   * A run of the last slot, an hour before `next`, is remembered by the limiter for most of the period: if
   * the limiter has none, the slot was missed and is run now. Once the window of such a run is over, the next
   * slot is near and takes it. The window of the late run ends before that slot, which it must not hold back.
   */
  private catchUpHourly(now: Date, next: Date): void {
    const lastSlot = new Date(next.getTime() - hourMs);
    if (now.getTime() - lastSlot.getTime() >= this.windowMs()) return;

    void this.run(Math.max(next.getTime() - now.getTime() - catchUpMarginMs, 1000), lastSlot);
  }

  private windowMs(): number {
    return Math.floor(schedulePeriodMs(this.schedule) * 0.9);
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

  /** `missed` is the slot a late run makes up for. */
  private async run(windowMs: number = this.windowMs(), missed?: Date): Promise<void> {
    try {
      const turn = await this.limiter.hit('price-refresh:run', { limit: 1, windowMs });
      if (!turn.allowed) return;

      if (missed !== undefined) {
        this.logger.info(
          `The refresh of the prices due at ${missed.toISOString()} was missed: running it now`,
        );
      }

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
