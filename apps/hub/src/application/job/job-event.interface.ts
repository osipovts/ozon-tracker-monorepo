import type { JobProgressInterface } from '../../domain/job/job.entity.js';

export type JobEventInterface = { jobId: string; at: Date } & (
  | { type: 'started' }
  | { type: 'progress'; progress: JobProgressInterface }
  | { type: 'completed' }
  | { type: 'failed'; reason: string; willRetry: boolean }
);
