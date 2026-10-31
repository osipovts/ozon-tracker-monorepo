import type { CredentialRepositoryPort } from '../application/credential-repository.port.js';
import type { CredentialEntity } from '../domain/credential.entity.js';

export class InMemoryCredentialRepositoryAdapter implements CredentialRepositoryPort {
  private readonly credentials = new Map<string, CredentialEntity>();

  save(credential: CredentialEntity): Promise<void> {
    this.credentials.set(credential.snapshot.userId, credential);

    return Promise.resolve();
  }

  delete(userId: string): Promise<void> {
    this.credentials.delete(userId);

    return Promise.resolve();
  }

  findByUserId(userId: string): Promise<CredentialEntity | null> {
    return Promise.resolve(this.credentials.get(userId) ?? null);
  }
}
