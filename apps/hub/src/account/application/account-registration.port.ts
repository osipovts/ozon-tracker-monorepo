import type { CredentialEntity } from '../domain/credential.entity.js';
import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { UserEntity } from '../domain/user.entity.js';

export const ACCOUNT_REGISTRATION = Symbol('AccountRegistrationPort');

export interface AccountRegistrationPort {
  /** Creates the user with the password credential, or neither; false if the email is taken. */
  registerWithPassword(user: UserEntity, credential: CredentialEntity): Promise<boolean>;
  /** Creates the user with the provider account they come from, or neither; false if the email is taken. */
  registerWithIdentity(user: UserEntity, identity: LinkedIdentityEntity): Promise<boolean>;
}
