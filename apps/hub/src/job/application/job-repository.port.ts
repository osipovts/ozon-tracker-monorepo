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

export interface JobActivityInterface {
  /** Whether a job of the kind, created since the given time, is queued, running or waiting for a retry. */
  active: boolean;
  /** When the latest job of the kind ended, completed or failed; null when none has. */
  lastFinishedAt: Date | null;
}

export interface JobRepositoryPort {
  /** What the jobs of the kind are doing; a job created before `activeSince` is taken for lost. */
  activity(kind: JobKindType, activeSince: Date): Promise<JobActivityInterface>;
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
