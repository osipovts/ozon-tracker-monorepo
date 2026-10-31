import { Injectable } from '@nestjs/common';
import { parseCookie } from 'cookie';

export const oauthLoginCookieName = 'oauth_login';

/** The path the cookie of a login in progress goes to: the callbacks, and nothing else of the hub. */
export const oauthLoginCookiePath = '/auth/oauth';

export const oauthLoginCookieMaxAgeMs = 10 * 60_000;

export interface OauthLoginSecretInterface {
  state: string;
  codeVerifier: string;
}

/** The cookie holds the state and the PKCE verifier of a login that has gone to the provider. */
@Injectable()
export class OauthLoginCookieParser {
  format({ state, codeVerifier }: OauthLoginSecretInterface): string {
    // Both are base64url, which has no dot.
    return `${state}.${codeVerifier}`;
  }

  parse(header: string | undefined): OauthLoginSecretInterface | null {
    const [state, codeVerifier, ...rest] = (
      parseCookie(header ?? '')[oauthLoginCookieName] ?? ''
    ).split('.');

    return state === undefined ||
      codeVerifier === undefined ||
      rest.length > 0 ||
      state === '' ||
      codeVerifier === ''
      ? null
      : { state, codeVerifier };
  }
}
