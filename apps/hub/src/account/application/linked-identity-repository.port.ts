import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';

export const LINKED_IDENTITY_REPOSITORY = Symbol('LinkedIdentityRepositoryPort');

export type UnlinkOutcomeType = 'unlinked' | 'not_linked' | 'last_login_method';

export interface LinkedIdentityRepositoryPort {
  /** Links the identity unless the provider account is linked already; tells which one happened. */
  add(identity: LinkedIdentityEntity): Promise<boolean>;
  /** The provider accounts the user logs in through, the oldest first. */
  listByUser(userId: string): Promise<LinkedIdentityEntity[]>;
  /** Takes the link to the provider away from the user; false if they had none. */
  remove(userId: string, provider: OauthProviderType): Promise<boolean>;
  /**
   * Takes the link to the provider away unless it is the last way for the user to log in: they have no
   * password (the caller says so) and no other link. The check and the removal are one step against the
   * same user, so that two unlinks at once cannot take both of the last two links.
   */
  unlink(
    userId: string,
    provider: OauthProviderType,
    hasPassword: boolean,
  ): Promise<UnlinkOutcomeType>;
  findByProviderSubject(
    provider: OauthProviderType,
    subject: string,
  ): Promise<LinkedIdentityEntity | null>;
}
