import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';
import { proxySourceSchema } from 'queue-contract';

import type { GetJobActivityUseCase } from '../../job/application/index.js';
import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';

export interface PeriodicProxyRefreshSettingsInterface {
  /** The pause between the end of a refresh and the start of the next; 0 turns the refresh off. */
  pauseMs: number;
  /** How often the hub looks whether the pause is over. */
  pollMs: number;
  maxCandidates: number;
  probeTimeoutMs: number;
}

/**
 * Queues the refresh of every proxy source, as the button of the admin panel does: when the hub starts and
 * then once the pause has passed since the last proxy job ended. A refresh that is still on its way holds the
 * next one back, so the pause is counted from the end of the work and not from its start. Of the instances
 * of the hub that share a Redis, only the first to reach a poll runs it.
 */
export class PeriodicProxyRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshProxySourceUseCase, 'execute'>,
    private readonly activity: Pick<GetJobActivityUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly settings: PeriodicProxyRefreshSettingsInterface,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    if (this.settings.pauseMs === 0) {
      this.logger.info('The refresh of the proxies is off (PROXY_REFRESH_PAUSE_MINUTES is 0)');

      return;
    }

    void this.run();
    this.timer = setInterval((): void => {
      void this.run();
    }, this.settings.pollMs);
    this.timer.unref();
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  private async isDue(): Promise<boolean> {
    const { active, lastFinishedAt } = await this.activity.execute('proxy_fetch');

    return (
      !active &&
      (lastFinishedAt === null || Date.now() - lastFinishedAt.getTime() >= this.settings.pauseMs)
    );
  }

  private async run(): Promise<void> {
    try {
      if (!(await this.isDue())) return;

      const turn = await this.limiter.hit('proxy-refresh:run', {
        limit: 1,
        windowMs: Math.floor(this.settings.pollMs * 0.9),
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
