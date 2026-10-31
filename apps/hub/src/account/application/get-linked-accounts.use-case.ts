import type { OauthProviderType } from '../domain/oauth-provider.type.js';
import type { CredentialRepositoryPort } from './credential-repository.port.js';
import type { LinkedIdentityRepositoryPort } from './linked-identity-repository.port.js';

export interface LinkedAccountsInterface {
  /** Whether the user can log in with a password. */
  hasPassword: boolean;
  identities: Array<{ provider: OauthProviderType; linkedAt: Date }>;
}

/** The ways the user logs in: a password, and the accounts at the providers. */
export class GetLinkedAccountsUseCase {
  constructor(
    private readonly credentials: CredentialRepositoryPort,
    private readonly identities: LinkedIdentityRepositoryPort,
  ) {}

  async execute(userId: string): Promise<LinkedAccountsInterface> {
    const [credential, identities] = await Promise.all([
      this.credentials.findByUserId(userId),
      this.identities.listByUser(userId),
    ]);

    return {
      hasPassword: credential !== null,
      identities: identities.map(({ snapshot }) => ({
        provider: snapshot.provider,
        linkedAt: snapshot.createdAt,
      })),
    };
  }
}
