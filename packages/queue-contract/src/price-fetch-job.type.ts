import { z } from 'zod';

import { browserSessionSchema } from './browser-session.type.js';
import { proxyServerSchema } from './proxy-server.type.js';

export const priceFetchRouteSchema = z.object({
  server: proxyServerSchema.nullable(),
  session: browserSessionSchema.optional(),
});

export const priceFetchJobSchema = z.object({
  jobId: z.uuid(),
  /** Routes in the order they are tried; a null server is a direct connection. */
  proxies: z.array(priceFetchRouteSchema).min(1),
  products: z
    .array(z.object({ trackedProductId: z.uuid(), url: z.url() }))
    .min(1)
    .max(50),
  timeoutMs: z.number().int().min(1000).max(60000),
});

export type PriceFetchJobType = z.infer<typeof priceFetchJobSchema>;
