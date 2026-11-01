import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';
import { proxySourceSchema } from 'queue-contract';

import type { GetJobActivityUseCase } from '../../job/application/index.js';
import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { ListProxiesToRecheckUseCase } from '../application/list-proxies-to-recheck.use-case.js';
import type { PruneProxiesUseCase } from '../application/prune-proxies.use-case.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';

export interface PeriodicProxyRefreshSettingsInterface {
  /** The pause between the end of a refresh and the start of the next; 0 turns the refresh off. */
  pauseMs: number;
  /** How often the hub looks whether the pause is over. */
  pollMs: number;
  maxCandidates: number;
  probeTimeoutMs: number;
}

/** The stored proxies, which the refresh keeps in order: drops the dead ones and tells which to check again. */
export interface ProxyUpkeepInterface {
  prune: Pick<PruneProxiesUseCase, 'execute'>;
  recheck: Pick<ListProxiesToRecheckUseCase, 'execute'>;
}

/**
 * Queues the refresh of every proxy source, as the button of the admin panel does: when the hub starts and
 * then once the pause has passed since the last proxy job ended. A refresh that is still on its way holds the
 * next one back, so the pause is counted from the end of the work and not from its start. Of the instances
 * of the hub that share a Redis, only the first to reach a poll runs it. The proxies no list has named since
 * the last refresh are checked again, shared among the jobs, and the dead ones among them that are out of the
 * lists for long are dropped first.
 */
export class PeriodicProxyRefreshAdapter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly refresh: Pick<RefreshProxySourceUseCase, 'execute'>,
    private readonly activity: Pick<GetJobActivityUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly upkeep: ProxyUpkeepInterface,
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

  /** Drops the expired proxies, and deals the ones to check again among the jobs, one share for each. */
  private async dueForRecheck(jobs: number): Promise<string[][]> {
    const shares: string[][] = Array.from({ length: jobs }, (): string[] => []);
    try {
      const now = new Date();
      await this.upkeep.prune.execute(now);
      const servers = await this.upkeep.recheck.execute(
        now,
        this.settings.pauseMs,
        this.settings.maxCandidates,
      );
      for (const [index, server] of servers.entries()) shares[index % jobs]?.push(server);
    } catch (error: unknown) {
      this.logger.warn(`The upkeep of the proxies failed: ${errorMessage(error)}`);
    }

    return shares;
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

    const sources = proxySourceSchema.options;
    const rechecks = await this.dueForRecheck(sources.length);

    // A source that cannot be queued does not keep the others from it.
    for (const [index, source] of sources.entries()) {
      try {
        await this.refresh.execute(
          source,
          {
            maxCandidates: this.settings.maxCandidates,
            probeTimeoutMs: this.settings.probeTimeoutMs,
          },
          null,
          rechecks[index],
        );
      } catch (error: unknown) {
        this.logger.warn(`The refresh of the proxies of ${source} failed: ${errorMessage(error)}`);
      }
    }
  }
}
