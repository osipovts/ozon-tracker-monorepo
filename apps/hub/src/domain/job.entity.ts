export type JobKindType = 'proxy_fetch' | 'price_fetch';

export type JobStatusType = 'queued' | 'running' | 'retrying' | 'completed' | 'failed';

export interface JobInterface {
  id: string;
  kind: JobKindType;
  /** The proxy source of a proxy job or the product id of a price job. */
  subject: string;
  status: JobStatusType;
  /** Completion of the job, from 0 to 100. */
  percent: number;
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
  percent: number;
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
      percent: 0,
      processed: 0,
      total,
      succeeded: 0,
      error: null,
      createdAt,
      startedAt: null,
      finishedAt: null,
    });
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
      percent: 100,
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
