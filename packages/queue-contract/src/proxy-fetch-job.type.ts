import { z } from 'zod';

import { proxyServerSchema } from './proxy-server.type.js';
import { proxySourceSchema } from './proxy-source.type.js';

export const proxyFetchJobSchema = z.object({
  jobId: z.uuid(),
  source: proxySourceSchema,
  /** Upper bound of candidates checked. */
  maxCandidates: z.number().int().min(1).max(5000),
  /** Proxies the hub already holds, which no list names lately: checked as well, they are not candidates of the source. */
  recheck: z.array(proxyServerSchema).max(5000).default([]),
  /** Timeout of a single proxy check. */
  probeTimeoutMs: z.number().int().min(1000).max(60000),
});

export type ProxyFetchJobType = z.infer<typeof proxyFetchJobSchema>;
