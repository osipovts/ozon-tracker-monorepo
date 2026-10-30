import { z } from 'zod';

import { pageResponseSchema } from '../../shared/presentation/pagination-query.type.js';
import { sessionStatuses } from '../domain/browser-session.entity.js';

export const sessionIdParamSchema = z.uuid();

/** A session without its cookies: they are never returned. */
export const sessionSchema = z.object({
  id: z.uuid(),
  marketplace: z.string(),
  /** Proxy URL the session was created through; null for a direct connection. */
  proxy: z.string().nullable(),
  exitIp: z.string(),
  userAgent: z.string(),
  /** A stale session is not given to the workers any more. */
  status: z.enum(sessionStatuses),
  staleReason: z.string().nullable(),
  cookies: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export type SessionType = z.infer<typeof sessionSchema>;

export const sessionListResponseSchema = pageResponseSchema(sessionSchema);

export type SessionListResponseType = z.infer<typeof sessionListResponseSchema>;
