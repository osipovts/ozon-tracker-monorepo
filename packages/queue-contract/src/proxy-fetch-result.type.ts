import { z } from 'zod';

import { jobDoneSchema, jobFailedSchema, jobStartedSchema } from './job-lifecycle.type.js';
import { jobProgressSchema } from './job-progress.type.js';
import { proxyServerSchema } from './proxy-server.type.js';
import { proxySourceSchema } from './proxy-source.type.js';

export const proxyFetchResultSchema = z.discriminatedUnion('type', [
  jobStartedSchema,
  jobProgressSchema,
  jobFailedSchema,
  jobDoneSchema,
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
        /** Whether a list of the source named the proxy; false for one only rechecked. */
        seen: z.boolean().default(true),
      }),
    ),
  }),
]);

export type ProxyFetchResultType = z.infer<typeof proxyFetchResultSchema>;
