import { z } from 'zod';

import { oauthProviders } from '../../account/application/index.js';

export const oauthProvidersResponseSchema = z.object({
  /** The providers a user can log in through, which are those whose OAuth app is set up. */
  providers: z.array(z.enum(oauthProviders)),
});

export type OauthProvidersResponseType = z.infer<typeof oauthProvidersResponseSchema>;
