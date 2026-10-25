import { z } from 'zod';

import { jobProgressSchema } from './job-progress.type.js';
import { readProductResultSchema } from './read-product-result.type.js';
import { storageStateSchema } from './storage-state.type.js';

export const priceFetchResultSchema = z.discriminatedUnion('type', [
  jobProgressSchema,
  z.object({
    type: z.literal('job_started'),
    jobId: z.uuid(),
  }),
  z.object({
    type: z.literal('job_failed'),
    jobId: z.uuid(),
    /** A short description without credentials. */
    reason: z.string(),
    /** True if the queue is going to deliver the job again. */
    willRetry: z.boolean(),
  }),
  z.object({
    type: z.literal('product_result'),
    jobId: z.uuid(),
    trackedProductId: z.uuid(),
    status: z.enum([
      'success',
      'partial',
      'challenge_required',
      'network_error',
      'proxy_rejected',
      'parse_error',
      'http_error',
      'no_proxies',
      'invalid_url',
    ]),
    /** Proxy URLs here never carry credentials. */
    attempts: z.array(
      z.object({
        proxy: z.string().nullable(),
        sessionId: z.uuid().optional(),
        result: readProductResultSchema,
      }),
    ),
  }),
  z.object({
    type: z.literal('session_update'),
    jobId: z.uuid(),
    sessionId: z.uuid(),
    storageState: storageStateSchema,
    observedAt: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('session_ip_mismatch'),
    jobId: z.uuid(),
    sessionId: z.uuid(),
    expectedIp: z.ipv4(),
    actualIp: z.ipv4(),
  }),
  z.object({
    type: z.literal('job_done'),
    jobId: z.uuid(),
  }),
]);

export type PriceFetchResultType = z.infer<typeof priceFetchResultSchema>;
