import type { LinkedIdentityRepositoryPort } from '../application/linked-identity-repository.port.js';
import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';

export class InMemoryLinkedIdentityRepositoryAdapter implements LinkedIdentityRepositoryPort {
  private readonly identities = new Map<string, LinkedIdentityEntity>();

  add(identity: LinkedIdentityEntity): Promise<boolean> {
    const { provider, subject } = identity.snapshot;
    const key = this.key(provider, subject);
    const taken = this.identities.has(key);
    if (!taken) this.identities.set(key, identity);

    return Promise.resolve(!taken);
  }

  findByProviderSubject(
    provider: OauthProviderType,
    subject: string,
  ): Promise<LinkedIdentityEntity | null> {
    return Promise.resolve(this.identities.get(this.key(provider, subject)) ?? null);
  }

  private key(provider: OauthProviderType, subject: string): string {
    return JSON.stringify([provider, subject]);
  }
}
