import { z } from 'zod';

export const proxySourceRefreshBodySchema = z
  .object({
    /** Upper bound of the candidates taken from the source. */
    maxCandidates: z.number().int().min(1).max(5000).default(200),
    /** Timeout of a single proxy check, in milliseconds. */
    probeTimeoutMs: z.number().int().min(1000).max(60000).default(10000),
  })
  .default({ maxCandidates: 200, probeTimeoutMs: 10000 });

export type ProxySourceRefreshBodyType = z.infer<typeof proxySourceRefreshBodySchema>;
