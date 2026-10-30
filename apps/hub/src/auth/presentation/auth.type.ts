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

export const authResponseSchema = z.object({
  /** Strict: a field that is not listed is never sent, and a test sees it if it is. */
  user: z.strictObject({ id: z.uuid(), email: z.string() }),
});

export type AuthResponseType = z.infer<typeof authResponseSchema>;
