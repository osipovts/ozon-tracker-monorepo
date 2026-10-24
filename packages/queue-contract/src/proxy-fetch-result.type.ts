import { z } from 'zod';

import { jobProgressSchema } from './job-progress.type.js';
import { proxyServerSchema } from './proxy-server.type.js';
import { proxySourceSchema } from './proxy-source.type.js';

export const proxyFetchResultSchema = z.discriminatedUnion('type', [
  jobProgressSchema,
  z.object({
    type: z.literal('job_started'),
    jobId: z.uuid(),
    sources: z.array(proxySourceSchema),
  }),
  z.object({
    type: z.literal('source_started'),
    jobId: z.uuid(),
    source: proxySourceSchema,
    /** How many candidates are going to be checked. */
    candidates: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('job_done'),
    jobId: z.uuid(),
    durationMs: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('job_failed'),
    jobId: z.uuid(),
    reason: z.string(),
    willRetry: z.boolean(),
  }),
  z.object({
    type: z.literal('proxy_checks'),
    jobId: z.uuid(),
    source: proxySourceSchema,
    checks: z.array(
      z.object({
        /** Proxy URL without credentials. */
        server: proxyServerSchema,
        alive: z.boolean(),
        /** Duration of the successful check; null when the proxy is not alive. */
        latencyMs: z.number().int().nonnegative().nullable(),
        /** ISO 3166-1 alpha-2 code of the exit country, null if unknown. */
        country: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .nullable(),
        exitIp: z.ipv4().nullable(),
        checkedAt: z.iso.datetime(),
      }),
    ),
  }),
  z.object({
    type: z.literal('source_done'),
    jobId: z.uuid(),
    source: proxySourceSchema,
    status: z.enum(['ok', 'failed']),
    candidates: z.number().int().nonnegative(),
    alive: z.number().int().nonnegative(),
  }),
]);

export type ProxyFetchResultType = z.infer<typeof proxyFetchResultSchema>;
