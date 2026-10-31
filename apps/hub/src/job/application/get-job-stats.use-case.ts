import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { JobKindType } from '../domain/job.entity.js';
import type { JobCountsType, JobRepositoryPort } from './job-repository.port.js';

export interface JobFailureInterface {
  id: string;
  kind: JobKindType;
  subject: string;
  error: string | null;
  finishedAt: Date | null;
}

export interface JobStatsInterface {
  /** The jobs that started in the last day, by status. */
  lastDay: JobCountsType;
  /** The latest jobs that failed for good, the newest first. */
  recentFailures: JobFailureInterface[];
}

const failuresShown = 5;

export class GetJobStatsUseCase {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(): Promise<JobStatsInterface> {
    const day = 24 * 60 * 60_000;
    const [lastDay, failed] = await Promise.all([
      this.jobs.countByStatus(new Date(this.clock.now().getTime() - day)),
      this.jobs.list({ status: 'failed' }, { page: 1, pageSize: failuresShown }),
    ]);

    return {
      lastDay,
      recentFailures: failed.items.map(({ snapshot }): JobFailureInterface => ({
        id: snapshot.id,
        kind: snapshot.kind,
        subject: snapshot.subject,
        error: snapshot.error,
        finishedAt: snapshot.finishedAt,
      })),
    };
  }
}
