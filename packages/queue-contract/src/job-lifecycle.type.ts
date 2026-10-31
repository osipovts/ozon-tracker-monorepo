import { z } from 'zod';

export const jobStartedSchema = z.object({
  type: z.literal('job_started'),
  jobId: z.uuid(),
});

export const jobFailedSchema = z.object({
  type: z.literal('job_failed'),
  jobId: z.uuid(),
  /** A short description without credentials. */
  reason: z.string(),
  /** True if the queue is going to deliver the job again. */
  willRetry: z.boolean(),
});

export const jobDoneSchema = z.object({
  type: z.literal('job_done'),
  jobId: z.uuid(),
});

/** Messages every worker reports about its job, whatever the work is. */
export type JobLifecycleType =
  | z.infer<typeof jobStartedSchema>
  | z.infer<typeof jobFailedSchema>
  | z.infer<typeof jobDoneSchema>;
