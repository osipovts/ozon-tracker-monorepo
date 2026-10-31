import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';
import { proxySourceSchema } from 'queue-contract';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';

export interface PeriodicProxyRefreshSettingsInterface {
  /** 0 turns the refresh off. */
  intervalMs: number;
  maxCandidates: number;
  probeTimeoutMs: number;
}

/**
 * Queues the refresh of every proxy source when the hub starts and then every interval, as the button of the
 * admin panel does. Of the instances of the hub that share a Redis, only the first to reach a window runs it:
 * the window is a little shorter than the interval, so a restart within it does not run it a second time.
 */
export class PeriodicProxyRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshProxySourceUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly settings: PeriodicProxyRefreshSettingsInterface,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    if (this.settings.intervalMs === 0) {
      this.logger.info('The refresh of the proxies is off (PROXY_REFRESH_INTERVAL_MINUTES is 0)');

      return;
    }

    void this.run();
    this.timer = setInterval((): void => {
      void this.run();
    }, this.settings.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  private async run(): Promise<void> {
    try {
      const turn = await this.limiter.hit('proxy-refresh:run', {
        limit: 1,
        windowMs: Math.floor(this.settings.intervalMs * 0.9),
      });
      if (!turn.allowed) return;
    } catch (error: unknown) {
      this.logger.warn(`The refresh of the proxies failed: ${errorMessage(error)}`);

      return;
    }

    // A source that cannot be queued does not keep the others from it.
    for (const source of proxySourceSchema.options) {
      try {
        await this.refresh.execute(
          source,
          {
            maxCandidates: this.settings.maxCandidates,
            probeTimeoutMs: this.settings.probeTimeoutMs,
          },
          null,
        );
      } catch (error: unknown) {
        this.logger.warn(`The refresh of the proxies of ${source} failed: ${errorMessage(error)}`);
      }
    }
  }
}
