import type { OauthProviderType } from '../../account/application/index.js';
import { createOauthChallenge } from './oauth-challenge.type.js';
import type { OauthProvidersType } from './oauth-provider.port.js';
import { OauthProviderNotConfiguredError } from './oauth-provider-not-configured.error.js';

export interface StartOauthLoginInterface {
  provider: OauthProviderType;
  /** Where the provider sends the user back to. */
  redirectUri: string;
}

export interface StartedOauthLoginInterface {
  /** Where to send the user to log in at the provider. */
  url: string;
  /** To keep in the browser of the user until the callback: only the provider and the callback see it. */
  state: string;
  codeVerifier: string;
}

export class StartOauthLoginUseCase {
  constructor(private readonly providers: OauthProvidersType) {}

  execute({ provider, redirectUri }: StartOauthLoginInterface): StartedOauthLoginInterface {
    const adapter = this.providers.get(provider);
    if (adapter === undefined) throw new OauthProviderNotConfiguredError(provider);

    const { state, codeVerifier, codeChallenge } = createOauthChallenge();

    return {
      url: adapter.authorizationUrl({ state, codeChallenge, redirectUri }),
      state,
      codeVerifier,
    };
  }
}
