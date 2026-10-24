import type { JobEntity, JobKindType, JobStatusType } from '../domain/job.entity.js';
import type { PageInterface, PaginationInterface } from './page.interface.js';

export const JOB_REPOSITORY = Symbol('JobRepositoryPort');

export interface JobFilterInterface {
  kind?: JobKindType;
  status?: JobStatusType;
}

export interface JobRepositoryPort {
  save(job: JobEntity): Promise<void>;
  findById(id: string): Promise<JobEntity | null>;
  /** Newest first. */
  list(
    filter: JobFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<JobEntity>>;
}
