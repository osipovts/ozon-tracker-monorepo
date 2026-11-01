import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  JobActivityInterface,
  JobCountsType,
  JobFilterInterface,
  JobRepositoryPort,
} from '../application/job-repository.port.js';
import type { JobEntity, JobKindType } from '../domain/job.entity.js';

export class InMemoryJobRepositoryAdapter implements JobRepositoryPort {
  private readonly jobs = new Map<string, JobEntity>();

  save(job: JobEntity): Promise<void> {
    this.jobs.set(job.snapshot.id, job);

    return Promise.resolve();
  }

  activity(kind: JobKindType, activeSince: Date): Promise<JobActivityInterface> {
    const ofKind = Array.from(this.jobs.values()).filter(
      ({ snapshot }): boolean => snapshot.kind === kind,
    );
    const finished = ofKind.flatMap(({ snapshot }): Date[] =>
      snapshot.finishedAt === null ? [] : [snapshot.finishedAt],
    );

    return Promise.resolve({
      active: ofKind.some((job): boolean => !job.finished && job.snapshot.createdAt >= activeSince),
      lastFinishedAt:
        finished.length === 0 ? null : new Date(Math.max(...finished.map((at) => at.getTime()))),
    });
  }

  countByStatus(since: Date): Promise<JobCountsType> {
    const counts: JobCountsType = { queued: 0, running: 0, retrying: 0, completed: 0, failed: 0 };
    for (const { snapshot } of this.jobs.values()) {
      if (snapshot.createdAt >= since) counts[snapshot.status] += 1;
    }

    return Promise.resolve(counts);
  }

  findById(id: string): Promise<JobEntity | null> {
    return Promise.resolve(this.jobs.get(id) ?? null);
  }

  list(
    filter: JobFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<JobEntity>> {
    const matching = Array.from(this.jobs.values())
      .filter(
        (job): boolean =>
          (filter.kind === undefined || job.snapshot.kind === filter.kind) &&
          (filter.status === undefined || job.snapshot.status === filter.status),
      )
      .toSorted((a, b): number => b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime());

    return Promise.resolve(pageOf(matching, pagination));
  }
}
