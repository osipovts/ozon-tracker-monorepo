import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { JobKindType } from '../domain/job.entity.js';
import type { JobActivityInterface, JobRepositoryPort } from './job-repository.port.js';

/** A job that is still not done after this long is taken for lost: it does not hold up what waits for it. */
const lostAfterMs = 60 * 60_000;

/** Tells what the jobs of a kind are doing: whether one is on its way, and when the last one ended. */
export class GetJobActivityUseCase {
  constructor(
    private readonly jobs: JobRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  execute(kind: JobKindType): Promise<JobActivityInterface> {
    return this.jobs.activity(kind, new Date(this.clock.now().getTime() - lostAfterMs));
  }
}
