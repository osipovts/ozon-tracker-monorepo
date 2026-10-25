export type JobKindType = 'proxy_fetch' | 'price_fetch';

export type JobStatusType = 'queued' | 'running' | 'retrying' | 'completed' | 'failed';

export interface JobInterface {
  id: string;
  kind: JobKindType;
  /** The proxy source of a proxy job or the product id of a price job. */
  subject: string;
  status: JobStatusType;
  processed: number;
  /** Null until the worker knows how much work there is. */
  total: number | null;
  succeeded: number;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface JobProgressInterface {
  processed: number;
  total: number;
  succeeded: number;
}

/** A job that has completed or failed for good does not change any more. */
export class JobEntity {
  constructor(readonly snapshot: JobInterface) {}

  static queued(
    id: string,
    kind: JobKindType,
    subject: string,
    total: number | null,
    createdAt: Date,
  ): JobEntity {
    return new JobEntity({
      id,
      kind,
      subject,
      status: 'queued',
      processed: 0,
      total,
      succeeded: 0,
      error: null,
      createdAt,
      startedAt: null,
      finishedAt: null,
    });
  }

  /** Completion of the job, from 0 to 100. */
  get percent(): number {
    if (this.snapshot.status === 'completed') return 100;

    const { processed, total } = this.snapshot;

    return total === null || total === 0 ? 0 : Math.floor((processed / total) * 100);
  }

  get finished(): boolean {
    return this.snapshot.status === 'completed' || this.snapshot.status === 'failed';
  }

  started(at: Date): JobEntity {
    if (this.finished) return this;
    return new JobEntity({
      ...this.snapshot,
      status: 'running',
      error: null,
      startedAt: this.snapshot.startedAt ?? at,
    });
  }

  progressed(progress: JobProgressInterface, at: Date): JobEntity {
    if (this.finished) return this;
    return new JobEntity({
      ...this.snapshot,
      ...progress,
      status: 'running',
      startedAt: this.snapshot.startedAt ?? at,
    });
  }

  completed(at: Date): JobEntity {
    if (this.finished) return this;
    return new JobEntity({
      ...this.snapshot,
      status: 'completed',
      error: null,
      startedAt: this.snapshot.startedAt ?? at,
      finishedAt: at,
    });
  }

  failed(reason: string, willRetry: boolean, at: Date): JobEntity {
    if (this.finished) return this;
    return new JobEntity({
      ...this.snapshot,
      status: willRetry ? 'retrying' : 'failed',
      error: reason,
      finishedAt: willRetry ? null : at,
    });
  }
}
