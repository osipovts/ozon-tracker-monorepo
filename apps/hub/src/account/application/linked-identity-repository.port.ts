import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';

export const LINKED_IDENTITY_REPOSITORY = Symbol('LinkedIdentityRepositoryPort');

export interface LinkedIdentityRepositoryPort {
  /** Links the identity unless the provider account is linked already; tells which one happened. */
  add(identity: LinkedIdentityEntity): Promise<boolean>;
  /** The provider accounts the user logs in through, the oldest first. */
  listByUser(userId: string): Promise<LinkedIdentityEntity[]>;
  /** Takes the link to the provider away from the user; false if they had none. */
  remove(userId: string, provider: OauthProviderType): Promise<boolean>;
  findByProviderSubject(
    provider: OauthProviderType,
    subject: string,
  ): Promise<LinkedIdentityEntity | null>;
}
