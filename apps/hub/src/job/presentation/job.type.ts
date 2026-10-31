import { z } from 'zod';

import {
  pageResponseSchema,
  paginationQuerySchema,
} from '../../shared/presentation/pagination-query.type.js';
import { jobKinds, jobStatuses } from '../domain/job.entity.js';

export const jobIdParamSchema = z.uuid();

const kindSchema = z.enum(jobKinds);
const statusSchema = z.enum(jobStatuses);

export const jobListQuerySchema = paginationQuerySchema.extend({
  kind: kindSchema.optional(),
  status: statusSchema.optional(),
});

export type JobListQueryType = z.infer<typeof jobListQuerySchema>;

export const jobSchema = z.object({
  id: z.uuid(),
  kind: kindSchema,
  /** The proxy source of a proxy job or the product id of a price job. */
  subject: z.string(),
  status: statusSchema,
  /** Completion of the job, from 0 to 100: poll it for a progress bar. */
  percent: z.number().int().min(0).max(100),
  processed: z.number().int(),
  /** Null until the worker knows how much work there is. */
  total: z.number().int().nullable(),
  succeeded: z.number().int(),
  /** The reason of the last failure, including the ones that are retried. */
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});

export type JobType = z.infer<typeof jobSchema>;

export const jobListResponseSchema = pageResponseSchema(jobSchema);

export type JobListResponseType = z.infer<typeof jobListResponseSchema>;
