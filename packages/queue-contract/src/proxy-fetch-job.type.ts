import { z } from 'zod';

import { proxySourceSchema } from './proxy-source.type.js';

export const proxyFetchJobSchema = z.object({
  jobId: z.uuid(),
  source: proxySourceSchema,
  /** Upper bound of candidates checked. */
  maxCandidates: z.number().int().min(1).max(5000),
  /** Timeout of a single proxy check. */
  probeTimeoutMs: z.number().int().min(1000).max(60000),
});

export type ProxyFetchJobType = z.infer<typeof proxyFetchJobSchema>;
