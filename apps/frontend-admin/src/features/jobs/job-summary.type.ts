import { isFinished } from './job-query.type.js';

export interface JobStateInterface {
  /** Undefined until the first answer about the job. */
  status: string | undefined;
  percent: number | undefined;
  error: Error | null;
}

export interface JobSummaryInterface {
  /** Null while there are no jobs. */
  percent: number | null;
  status: string | null;
  error: Error | null;
}

/** Several jobs as one: the average progress, and the status of the ones that have not ended, else of the way they ended. */
export function summarizeJobs(jobs: JobStateInterface[]): JobSummaryInterface {
  const error = jobs.find((job): boolean => job.error !== null)?.error ?? null;
  if (jobs.length === 0) return { percent: null, status: null, error };

  const statuses = jobs.map((job): string | undefined => job.status);
  const unfinished = statuses.find((status): boolean => !isFinished(status));
  const percent = Math.round(
    jobs.reduce((sum, job): number => sum + (job.percent ?? 0), 0) / jobs.length,
  );

  if (unfinished !== undefined) return { percent, status: unfinished, error };
  if (statuses.includes(undefined)) return { percent, status: 'queued', error };

  return { percent, status: statuses.includes('failed') ? 'failed' : 'completed', error };
}
