import { marketplaceSchema, proxyServerSchema } from 'queue-contract';
import { z } from 'zod';

import { sessionStatuses } from '../../browser-session/application/index.js';
import {
  pageResponseSchema,
  paginationQuerySchema,
} from '../../shared/presentation/pagination-query.type.js';

export const proxyListQuerySchema = paginationQuerySchema.extend({
  /** Only the alive ones (`true`) or only the dead (`false`); both when omitted. */
  alive: z.enum(['true', 'false']).optional(),
  /** Only the proxies an administrator turned off (`true`), or only those that are on (`false`). */
  disabled: z.enum(['true', 'false']).optional(),
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
  /** Turned off by an administrator: the workers are not given it. */
  disabled: z.boolean(),
  /** The session of the marketplace bound to the proxy, whatever its status. */
  session: z
    .object({
      id: z.uuid(),
      status: z.enum(sessionStatuses),
      staleReason: z.string().nullable(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
});

export const proxyListResponseSchema = pageResponseSchema(proxyItemSchema);

export type ProxyListResponseType = z.infer<typeof proxyListResponseSchema>;

export const proxyServerQuerySchema = z.object({
  /** The proxy URL as the list shows it, without credentials. */
  server: proxyServerSchema,
});

export type ProxyServerQueryType = z.infer<typeof proxyServerQuerySchema>;

export const proxyDisabledBodySchema = z.object({ disabled: z.boolean() });

export type ProxyDisabledBodyType = z.infer<typeof proxyDisabledBodySchema>;
