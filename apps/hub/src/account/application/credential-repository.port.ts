import type { CredentialEntity } from '../domain/credential.entity.js';

export const CREDENTIAL_REPOSITORY = Symbol('CredentialRepositoryPort');

export interface CredentialRepositoryPort {
  /** Sets the credential of the user, replacing the previous one. */
  save(credential: CredentialEntity): Promise<void>;
  findByUserId(userId: string): Promise<CredentialEntity | null>;
}
