import { z } from 'zod';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import type {
  OauthAuthorizationInterface,
  OauthExchangeInterface,
  OauthProfileInterface,
  OauthProviderPort,
} from '../application/oauth-provider.port.js';
import {
  type OauthClientInterface,
  OauthTokenExchangeAdapter,
} from './oauth-token-exchange.adapter.js';

export interface GoogleEndpointsInterface {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
}

const googleEndpoints: GoogleEndpointsInterface = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
};

const requestTimeoutMs = 10_000;

const userinfoSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1).optional(),
  email_verified: z.union([z.boolean(), z.stringbool()]).optional(),
});

/**
 * Google as an OpenID Connect provider. The profile comes from the userinfo endpoint with the access
 * token the token endpoint gave over TLS, so the ID token needs no signature check of its own.
 */
export class GoogleOauthProviderAdapter implements OauthProviderPort {
  private readonly tokens: OauthTokenExchangeAdapter;

  constructor(
    private readonly client: Omit<OauthClientInterface, 'tokenUrl'>,
    private readonly endpoints: GoogleEndpointsInterface = googleEndpoints,
  ) {
    this.tokens = new OauthTokenExchangeAdapter({ ...client, tokenUrl: endpoints.tokenUrl });
  }

  authorizationUrl({ state, codeChallenge, redirectUri }: OauthAuthorizationInterface): string {
    const url = new URL(this.endpoints.authorizeUrl);
    url.search = new URLSearchParams([
      ['client_id', this.client.clientId],
      ['redirect_uri', redirectUri],
      ['response_type', 'code'],
      ['scope', 'openid email'],
      ['state', state],
      ['code_challenge', codeChallenge],
      ['code_challenge_method', 'S256'],
    ]).toString();

    return url.toString();
  }

  async fetchProfile(input: OauthExchangeInterface): Promise<OauthProfileInterface> {
    const accessToken = await this.tokens.exchange(input);

    let response: Response;
    try {
      response = await fetch(this.endpoints.userinfoUrl, {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new OauthLoginFailedError('Google could not be reached');
    }

    const profile = userinfoSchema.safeParse(await response.json().catch((): unknown => null));
    if (!response.ok || !profile.success) {
      throw new OauthLoginFailedError(`Google gave no profile (HTTP ${String(response.status)})`);
    }

    const { sub, email, email_verified: verified } = profile.data;

    return {
      subject: sub,
      email: email ?? null,
      emailVerified: email !== undefined && verified === true,
    };
  }
}
