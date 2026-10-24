import { z } from 'zod';

/** Absolute progress of a job, so a redelivered message cannot count twice. */
export const jobProgressSchema = z.object({
  type: z.literal('job_progress'),
  jobId: z.uuid(),
  /** Completion of the whole job, from 0 to 100. */
  percent: z.number().int().min(0).max(100),
  /** Units of work finished: products read or proxies checked. */
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Units finished successfully: products read or proxies alive. */
  succeeded: z.number().int().nonnegative(),
});

export type JobProgressType = z.infer<typeof jobProgressSchema>;
