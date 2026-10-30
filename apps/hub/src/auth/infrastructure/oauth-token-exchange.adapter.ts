import { z } from 'zod';

import { OauthLoginFailedError } from '../application/oauth-login-failed.error.js';
import type { OauthExchangeInterface } from '../application/oauth-provider.port.js';

export interface OauthClientInterface {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

const requestTimeoutMs = 10_000;

const accessTokenSchema = z.object({ access_token: z.string().min(1) });
const refusalSchema = z.object({ error: z.string() });

/** The step both providers share: the code and the PKCE verifier for the access token. */
export class OauthTokenExchangeAdapter {
  constructor(private readonly client: OauthClientInterface) {}

  async exchange({ code, codeVerifier, redirectUri }: OauthExchangeInterface): Promise<string> {
    let response: Response;
    try {
      response = await fetch(this.client.tokenUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams([
          ['client_id', this.client.clientId],
          ['client_secret', this.client.clientSecret],
          ['code', code],
          ['code_verifier', codeVerifier],
          ['redirect_uri', redirectUri],
          ['grant_type', 'authorization_code'],
        ]),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      throw new OauthLoginFailedError('the provider could not be reached');
    }

    // GitHub refuses with a 200, Google with a 400: either way the answer says what went wrong.
    const body: unknown = await response.json().catch((): unknown => null);
    const token = accessTokenSchema.safeParse(body);
    if (response.ok && token.success) return token.data.access_token;

    const refusal = refusalSchema.safeParse(body);

    throw new OauthLoginFailedError(
      refusal.success
        ? `the provider refused the code (${refusal.data.error})`
        : `the provider answered HTTP ${String(response.status)} without a token`,
    );
  }
}
