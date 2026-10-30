import { createHash, timingSafeEqual } from 'node:crypto';

import type {
  OauthProviderType,
  ResolveOauthAccountUseCase,
} from '../../account/application/index.js';
import type {
  RevokeOtherAuthSessionsUseCase,
  StartAuthSessionUseCase,
} from '../../auth-session/application/index.js';
import type {
  AuthenticatedSessionInterface,
  ClientInterface,
} from './authenticated-session.interface.js';
import { OauthLoginFailedError } from './oauth-login-failed.error.js';
import type { OauthProvidersType } from './oauth-provider.port.js';
import { OauthProviderNotConfiguredError } from './oauth-provider-not-configured.error.js';

export interface CompleteOauthLoginInterface extends ClientInterface {
  provider: OauthProviderType;
  /** What the provider sent back with the user. */
  code: string;
  state: string;
  /** What the browser of the user kept since the start. */
  expectedState: string;
  codeVerifier: string;
  redirectUri: string;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Logs the user in by the code the provider sent them back with, signing them up on the first login. */
export class CompleteOauthLoginUseCase {
  constructor(
    private readonly providers: OauthProvidersType,
    private readonly resolveAccount: ResolveOauthAccountUseCase,
    private readonly startSession: StartAuthSessionUseCase,
    private readonly revokeSessions: RevokeOtherAuthSessionsUseCase,
  ) {}

  async execute(input: CompleteOauthLoginInterface): Promise<AuthenticatedSessionInterface> {
    const adapter = this.providers.get(input.provider);
    if (adapter === undefined) throw new OauthProviderNotConfiguredError(input.provider);

    // The state is how a callback is known to answer a login started in this very browser.
    if (!timingSafeEqual(digest(input.state), digest(input.expectedState))) {
      throw new OauthLoginFailedError('the login was not started in this browser');
    }

    const profile = await adapter.fetchProfile({
      code: input.code,
      codeVerifier: input.codeVerifier,
      redirectUri: input.redirectUri,
    });
    const { user, claimed } = await this.resolveAccount.execute({
      provider: input.provider,
      ...profile,
    });
    // Whoever signed the account up first loses it with the password: no session of theirs may outlive that.
    if (claimed) await this.revokeSessions.execute(user.id, null);

    const { token, expiresAt } = await this.startSession.execute({
      userId: user.id,
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return { user, token, expiresAt };
  }
}
