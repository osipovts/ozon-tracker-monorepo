import { sessionExportFileSchema } from 'queue-contract';
import { z } from 'zod';

export { sessionExportFileSchema };

export const sessionIdParamSchema = z.uuid();

/** A session without its cookies: they are never returned. */
export const sessionSchema = z.object({
  id: z.uuid(),
  marketplace: z.string(),
  /** Proxy URL the session was created through; null for a direct connection. */
  proxy: z.string().nullable(),
  exitIp: z.string(),
  userAgent: z.string(),
  platform: z.string(),
  browserVersion: z.string(),
  /** A stale session is not given to the workers any more. */
  status: z.enum(['active', 'stale']),
  staleReason: z.string().nullable(),
  cookies: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export type SessionType = z.infer<typeof sessionSchema>;

export const sessionListResponseSchema = z.object({
  items: z.array(sessionSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type SessionListResponseType = z.infer<typeof sessionListResponseSchema>;
