import type { JobEntity } from '../domain/job.entity.js';
import { JobNotFoundError } from './job-not-found.error.js';
import type { JobRepositoryPort } from './job-repository.port.js';

export class GetJobUseCase {
  constructor(private readonly jobs: JobRepositoryPort) {}

  async execute(jobId: string): Promise<JobEntity> {
    const job = await this.jobs.findById(jobId);
    if (job === null) throw new JobNotFoundError(jobId);
    return job;
  }
}
