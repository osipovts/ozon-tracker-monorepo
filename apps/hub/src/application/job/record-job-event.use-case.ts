import { type LoggerPort, silentLogger } from 'logger';

import type { JobEntity } from '../../domain/job/job.entity.js';
import type { JobEventInterface } from './job-event.interface.js';
import type { JobRepositoryPort } from './job-repository.port.js';

export class RecordJobEventUseCase {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(event: JobEventInterface): Promise<void> {
    const job = await this.jobs.findById(event.jobId);
    if (job === null) {
      this.logger.warn(`Ignoring a ${event.type} event of the unknown job ${event.jobId}`);
      return;
    }
    const next = this.apply(job, event);
    if (next === job) {
      this.logger.debug(
        `Job ${event.jobId} is already ${job.snapshot.status}: ${event.type} ignored`,
      );
      return;
    }
    await this.jobs.save(next);
    this.logger.verbose(
      `Job ${event.jobId}: ${event.type} -> ${next.snapshot.status} ${String(next.snapshot.percent)}%`,
    );
  }

  private apply(job: JobEntity, event: JobEventInterface): JobEntity {
    switch (event.type) {
      case 'started':
        return job.started(event.at);
      case 'progress':
        return job.progressed(event.progress, event.at);
      case 'completed':
        return job.completed(event.at);
      case 'failed':
        return job.failed(event.reason, event.willRetry, event.at);
    }
  }
}
