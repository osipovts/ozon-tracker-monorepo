import type { JobEntity } from '../domain/job.entity.js';
import { JobNotFoundError } from './job-not-found.error.js';
import type { JobRepositoryPort } from './job-repository.port.js';

export class GetJobUseCase {
  constructor(private readonly jobs: JobRepositoryPort) {}

  /** A job is the user's who requested it; to anyone else, and for an operator's job, it does not exist. */
  async execute(userId: string, jobId: string): Promise<JobEntity> {
    const job = await this.jobs.findById(jobId);
    if (job?.snapshot.requestedBy !== userId) throw new JobNotFoundError(jobId);

    return job;
  }
}
