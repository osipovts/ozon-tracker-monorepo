import type { OauthProviderType } from './oauth-provider.type.js';

export interface LinkedIdentityInterface {
  id: string;
  userId: string;
  provider: OauthProviderType;
  /** The id of the user at the provider: stable, unlike the email. */
  subject: string;
  createdAt: Date;
}

/** An account of a provider that signs its user in. */
export class LinkedIdentityEntity {
  constructor(readonly snapshot: LinkedIdentityInterface) {}
}
