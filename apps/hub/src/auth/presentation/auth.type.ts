import { z } from 'zod';

const emailSchema = z.email().max(254);

export const registerBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export type RegisterBodyType = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type LoginBodyType = z.infer<typeof loginBodySchema>;

export const passwordChangeBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export type PasswordChangeBodyType = z.infer<typeof passwordChangeBodySchema>;

export const authResponseSchema = z.object({
  /** Strict: a field that is not listed is never sent, and a test sees it if it is. */
  user: z.strictObject({ id: z.uuid(), email: z.string() }),
});

export type AuthResponseType = z.infer<typeof authResponseSchema>;

export const authSessionIdParamSchema = z.uuid();

export const authSessionsResponseSchema = z.object({
  sessions: z.array(
    z.strictObject({
      id: z.uuid(),
      /** What the browser called itself at the login. */
      userAgent: z.string().nullable(),
      ip: z.string().nullable(),
      createdAt: z.iso.datetime(),
      lastSeenAt: z.iso.datetime(),
      /** Where the session ends if it is not used. */
      expiresAt: z.iso.datetime(),
      /** The session this request came with. */
      current: z.boolean(),
    }),
  ),
});

export type AuthSessionsResponseType = z.infer<typeof authSessionsResponseSchema>;

export const revokedResponseSchema = z.strictObject({ revoked: z.number().int().min(0) });

export type RevokedResponseType = z.infer<typeof revokedResponseSchema>;
