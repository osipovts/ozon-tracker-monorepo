import type { AccountRegistrationPort } from '../application/account-registration.port.js';
import type { CredentialRepositoryPort } from '../application/credential-repository.port.js';
import type { LinkedIdentityRepositoryPort } from '../application/linked-identity-repository.port.js';
import type { UserRepositoryPort } from '../application/user-repository.port.js';
import type { CredentialEntity } from '../domain/credential.entity.js';
import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { UserEntity } from '../domain/user.entity.js';
import { InMemoryLinkedIdentityRepositoryAdapter } from './in-memory-linked-identity-repository.adapter.js';

export class InMemoryAccountRegistrationAdapter implements AccountRegistrationPort {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly credentials: CredentialRepositoryPort,
    private readonly identities: LinkedIdentityRepositoryPort = new InMemoryLinkedIdentityRepositoryAdapter(),
  ) {}

  async registerWithPassword(user: UserEntity, credential: CredentialEntity): Promise<boolean> {
    if (!(await this.users.add(user))) return false;

    await this.credentials.save(credential);

    return true;
  }

  async registerWithIdentity(user: UserEntity, identity: LinkedIdentityEntity): Promise<boolean> {
    if (!(await this.users.add(user))) return false;

    await this.identities.add(identity);

    return true;
  }
}
