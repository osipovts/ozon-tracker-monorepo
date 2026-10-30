import { createHash } from 'node:crypto';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import type {
  OauthAuthorizationInterface,
  OauthExchangeInterface,
  OauthProfileInterface,
  OauthProviderPort,
} from '../application/oauth-provider.port.js';

/** A provider that accepts the code `good-code` only with the verifier of the challenge it was sent. */
export class FakeOauthProviderAdapter implements OauthProviderPort {
  /** Whom the provider answers with: change it to play another user. */
  profile: OauthProfileInterface = {
    subject: '1001',
    email: 'jane@example.com',
    emailVerified: true,
  };
  exchanges = 0;
  private challenge = '';

  authorizationUrl({ state, codeChallenge }: OauthAuthorizationInterface): string {
    this.challenge = codeChallenge;

    return `https://provider.test/authorize?${new URLSearchParams([['state', state]]).toString()}`;
  }

  fetchProfile({ code, codeVerifier }: OauthExchangeInterface): Promise<OauthProfileInterface> {
    this.exchanges += 1;
    const verified =
      createHash('sha256').update(codeVerifier).digest('base64url') === this.challenge;

    return code === 'good-code' && verified
      ? Promise.resolve(this.profile)
      : Promise.reject(new OauthLoginFailedError('the provider refused the code'));
  }
}
