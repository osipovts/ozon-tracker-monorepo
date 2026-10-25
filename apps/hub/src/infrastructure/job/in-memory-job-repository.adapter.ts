import type {
  JobFilterInterface,
  JobRepositoryPort,
} from '../../application/job/job-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import type { JobEntity } from '../../domain/job/job.entity.js';

export class InMemoryJobRepositoryAdapter implements JobRepositoryPort {
  private readonly jobs = new Map<string, JobEntity>();

  save(job: JobEntity): Promise<void> {
    this.jobs.set(job.snapshot.id, job);
    return Promise.resolve();
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
    const start = (pagination.page - 1) * pagination.pageSize;
    return Promise.resolve({
      items: matching.slice(start, start + pagination.pageSize),
      total: matching.length,
    });
  }
}
