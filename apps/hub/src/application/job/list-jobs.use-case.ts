import type { JobEntity } from '../../domain/job/job.entity.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';
import type { JobFilterInterface, JobRepositoryPort } from './job-repository.port.js';

export class ListJobsUseCase {
  constructor(private readonly jobs: JobRepositoryPort) {}

  execute(
    filter: JobFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<JobEntity>> {
    return this.jobs.list(filter, pagination);
  }
}
