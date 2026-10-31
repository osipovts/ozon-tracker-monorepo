import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { JobEntity, JobKindType, JobStatusType } from '../domain/job.entity.js';

export const JOB_REPOSITORY = Symbol('JobRepositoryPort');

export interface JobFilterInterface {
  kind?: JobKindType;
  status?: JobStatusType;
}

export type JobCountsType = Record<JobStatusType, number>;

export interface JobRepositoryPort {
  /** How many jobs started since the time are in each status. */
  countByStatus(since: Date): Promise<JobCountsType>;
  save(job: JobEntity): Promise<void>;
  findById(id: string): Promise<JobEntity | null>;
  /** Newest first. */
  list(
    filter: JobFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<JobEntity>>;
}
