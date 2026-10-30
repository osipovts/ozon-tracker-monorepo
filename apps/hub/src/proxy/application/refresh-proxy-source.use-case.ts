import { randomUUID } from 'node:crypto';

import { type LoggerPort, silentLogger } from 'logger';
import type { ProxySourceType } from 'queue-contract';

import type { JobQueuePort } from '../../job/application/job-queue.port.js';
import type { JobRepositoryPort } from '../../job/application/job-repository.port.js';
import { JobEntity } from '../../job/domain/job.entity.js';

export interface RefreshProxySourceOptionsInterface {
  maxCandidates: number;
  probeTimeoutMs: number;
}

export class RefreshProxySourceUseCase {
  constructor(
    private readonly queue: JobQueuePort,
    private readonly jobs: JobRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    source: ProxySourceType,
    options: RefreshProxySourceOptionsInterface,
  ): Promise<{ jobId: string }> {
    const jobId = randomUUID();
    const job = JobEntity.queued(jobId, 'proxy_fetch', source, null, new Date());
    await this.jobs.save(job);

    try {
      await this.queue.enqueueProxyFetch({ jobId, source, ...options });
    } catch (error: unknown) {
      await this.jobs.save(job.failed('Could not be queued', false, new Date()));
      throw error;
    }

    this.logger.info(
      `Queued proxy refresh ${jobId}: ${source}, up to ${String(options.maxCandidates)} candidates`,
    );

    return { jobId };
  }
}
