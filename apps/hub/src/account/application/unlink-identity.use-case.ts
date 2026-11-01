import type { OauthProviderType } from '../domain/oauth-provider.type.js';
import type { CredentialRepositoryPort } from './credential-repository.port.js';
import { IdentityNotFoundError } from './identity-not-found.error.js';
import { LastLoginMethodError } from './last-login-method.error.js';
import type { LinkedIdentityRepositoryPort } from './linked-identity-repository.port.js';

/**
 * Takes the link to a provider away from the user, who logs in through that provider no more. The last
 * way to log in stays: the user would be locked out of an account that only they can open.
 */
export class UnlinkIdentityUseCase {
  constructor(
    private readonly credentials: CredentialRepositoryPort,
    private readonly identities: LinkedIdentityRepositoryPort,
  ) {}

  async execute(userId: string, provider: OauthProviderType): Promise<void> {
    const hasPassword = (await this.credentials.findByUserId(userId)) !== null;

    const outcome = await this.identities.unlink(userId, provider, hasPassword);
    if (outcome === 'not_linked') throw new IdentityNotFoundError(provider);
    if (outcome === 'last_login_method') throw new LastLoginMethodError();
  }
}
