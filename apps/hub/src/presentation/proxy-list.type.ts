import { marketplaceSchema } from 'queue-contract';
import { z } from 'zod';

import { paginationQuerySchema } from './pagination-query.type.js';

export const proxyListQuerySchema = paginationQuerySchema.extend({
  /** Only alive proxies by default. */
  alive: z.enum(['true', 'false']).default('true'),
  /** ISO 3166-1 alpha-2 code of the exit country. */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  /** The marketplace whose sessions make a proxy ready. */
  marketplace: marketplaceSchema.default('ozon'),
  /** `false` lists the proxies that still need a session. */
  ready: z.enum(['true', 'false']).optional(),
});

export type ProxyListQueryType = z.infer<typeof proxyListQuerySchema>;

export const proxyItemSchema = z.object({
  server: z.string(),
  source: z.string(),
  country: z.string().nullable(),
  exitIp: z.string().nullable(),
  alive: z.boolean(),
  /** Latency of the last successful check, in milliseconds. */
  latencyMs: z.number().int().nullable(),
  /** Share of successful checks, from 0 to 1. */
  successRate: z.number(),
  checksTotal: z.number().int(),
  lastCheckedAt: z.iso.datetime(),
  /** True if the proxy has an active session of the marketplace. */
  ready: z.boolean(),
  /** The session of the marketplace bound to the proxy, whatever its status. */
  session: z
    .object({
      id: z.uuid(),
      status: z.enum(['active', 'stale']),
      staleReason: z.string().nullable(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
});

export const proxyListResponseSchema = z.object({
  items: z.array(proxyItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type ProxyListResponseType = z.infer<typeof proxyListResponseSchema>;
