import { z } from 'zod';

import { oauthProviders } from '../../account/application/index.js';

export const accountResponseSchema = z.strictObject({
  email: z.string(),
  emailVerified: z.boolean(),
  /** Whether the user can log in with a password. */
  hasPassword: z.boolean(),
  /** The accounts at the providers the user logs in through. */
  identities: z.array(
    z.strictObject({ provider: z.enum(oauthProviders), linkedAt: z.iso.datetime() }),
  ),
});

export type AccountResponseType = z.infer<typeof accountResponseSchema>;

export const identityProviderParamSchema = z.enum(oauthProviders);

export const accountDeletionBodySchema = z.object({
  /** The email of the account, written by the user to confirm that they mean it. */
  email: z.email().max(254),
});

export type AccountDeletionBodyType = z.infer<typeof accountDeletionBodySchema>;
