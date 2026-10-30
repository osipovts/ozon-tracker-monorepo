import { type LoggerPort, silentLogger } from 'logger';
import type { ProxySourceType } from 'queue-contract';

import type { ScheduleJobUseCase } from '../../job/application/index.js';

export interface RefreshProxySourceOptionsInterface {
  maxCandidates: number;
  probeTimeoutMs: number;
}

export class RefreshProxySourceUseCase {
  constructor(
    private readonly scheduleJob: ScheduleJobUseCase,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    source: ProxySourceType,
    options: RefreshProxySourceOptionsInterface,
  ): Promise<{ jobId: string }> {
    const { jobId } = await this.scheduleJob.execute({
      kind: 'proxy_fetch',
      requestedBy: null,
      source,
      ...options,
    });

    this.logger.info(
      `Queued proxy refresh ${jobId}: ${source}, up to ${String(options.maxCandidates)} candidates`,
    );

    return { jobId };
  }
}
