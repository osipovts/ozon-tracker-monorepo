import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';
import { handbookSchema, type HandbookType } from 'queue-contract';

import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { HandbookRepositoryPort } from '../application/handbook-repository.port.js';
import type { RefreshHandbookUseCase } from '../application/refresh-handbook.use-case.js';

export interface PeriodicHandbookRefreshSettingsInterface {
  /** A handbook older than this is read again. */
  maxAgeMs: number;
  /** How often the age of the handbooks is looked at. */
  checkIntervalMs: number;
}

/**
 * Queues the read of the handbooks that were never read or have grown old, when the hub starts and then
 * every check interval: a hub that was down when one was due reads it as soon as it is up, since the age
 * comes from the time the handbook was kept. Of the instances of the hub that share a Redis, only the
 * first to reach a window asks, and a read that fails is asked for again at the next check.
 */
export class PeriodicHandbookRefreshAdapter
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshHandbookUseCase, 'execute'>,
    private readonly handbooks: HandbookRepositoryPort,
    private readonly limiter: RateLimiterPort,
    private readonly settings: PeriodicHandbookRefreshSettingsInterface,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.run();
    this.timer = setInterval((): void => {
      void this.run();
    }, this.settings.checkIntervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;

    return Promise.resolve();
  }

  private async run(): Promise<void> {
    for (const handbook of handbookSchema.options) {
      try {
        if (await this.isDue(handbook)) await this.ask(handbook);
      } catch (error: unknown) {
        this.logger.warn(`The refresh of the handbook ${handbook} failed: ${errorMessage(error)}`);
      }
    }
  }

  private async isDue(handbook: HandbookType): Promise<boolean> {
    const stored = await this.handbooks.findCities(handbook);

    return stored === null || Date.now() - stored.fetchedAt.getTime() >= this.settings.maxAgeMs;
  }

  private async ask(handbook: HandbookType): Promise<void> {
    const turn = await this.limiter.hit(`handbook-refresh:${handbook}`, {
      limit: 1,
      windowMs: Math.floor(this.settings.checkIntervalMs * 0.9),
    });
    if (!turn.allowed) return;

    const { jobId } = await this.refresh.execute(handbook, null);
    this.logger.info(`Queued the read of the handbook ${handbook}: job ${jobId}`);
  }
}
