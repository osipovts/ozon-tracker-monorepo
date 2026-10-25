import { z } from 'zod';

/** Absolute progress of a job, so a redelivered message cannot count twice. */
export const jobProgressSchema = z.object({
  type: z.literal('job_progress'),
  jobId: z.uuid(),
  /** Units of work finished: products read or proxies checked. */
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Units finished successfully: products read or proxies alive. */
  succeeded: z.number().int().nonnegative(),
});
