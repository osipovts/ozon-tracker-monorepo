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

  listByUser(userId: string): Promise<LinkedIdentityEntity[]> {
    return Promise.resolve(
      Array.from(this.identities.values())
        .filter(({ snapshot }): boolean => snapshot.userId === userId)
        .toSorted(
          (a, b): number => a.snapshot.createdAt.getTime() - b.snapshot.createdAt.getTime(),
        ),
    );
  }

  remove(userId: string, provider: OauthProviderType): Promise<boolean> {
    const found = Array.from(this.identities.entries()).filter(
      ([, { snapshot }]): boolean => snapshot.userId === userId && snapshot.provider === provider,
    );
    for (const [key] of found) this.identities.delete(key);

    return Promise.resolve(found.length > 0);
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
