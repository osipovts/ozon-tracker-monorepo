import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { errorMessage, type LoggerPort } from 'logger';

import type { PurgeAuthSessionsUseCase } from '../application/purge-auth-sessions.use-case.js';

/** Runs the purge of the ended sessions when the hub starts and then every interval. */
export class PeriodicAuthSessionPurgeAdapter
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly purge: Pick<PurgeAuthSessionsUseCase, 'execute'>,
    private readonly intervalMs: number,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.run();
    // Every instance of the hub runs it: deleting what is deleted already is no harm.
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
      const purged = await this.purge.execute();
      if (purged > 0) this.logger.info(`Purged ${String(purged)} ended sessions`);
      else this.logger.debug('No ended sessions to purge');
    } catch (error: unknown) {
      this.logger.warn(`Could not purge the ended sessions: ${errorMessage(error)}`);
    }
  }
}
