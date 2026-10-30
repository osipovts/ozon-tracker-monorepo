import type { CredentialEntity } from '../domain/credential.entity.js';
import type { UserEntity } from '../domain/user.entity.js';

export const ACCOUNT_REGISTRATION = Symbol('AccountRegistrationPort');

export interface AccountRegistrationPort {
  /** Creates the user with the password credential, or neither; false if the email is taken. */
  registerWithPassword(user: UserEntity, credential: CredentialEntity): Promise<boolean>;
}
