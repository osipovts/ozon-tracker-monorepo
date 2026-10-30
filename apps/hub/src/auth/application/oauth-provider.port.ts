import type { OauthProviderType } from '../../account/application/index.js';

export interface OauthProfileInterface {
  /** The id of the user at the provider: stable, unlike the email. */
  subject: string;
  email: string | null;
  /** Whether the provider vouches that the email is the user's. */
  emailVerified: boolean;
}

export interface OauthAuthorizationInterface {
  /** Comes back with the code: proves that the login was started in this browser. */
  state: string;
  /** The S256 challenge of the PKCE verifier kept by the browser of the user. */
  codeChallenge: string;
  redirectUri: string;
}

export interface OauthExchangeInterface {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** One provider of the sign-in: where to send the user, and whom the code they come back with is. */
export interface OauthProviderPort {
  authorizationUrl(input: OauthAuthorizationInterface): string;
  /** Trades the code for the profile of the user; refuses a code the provider does not accept. */
  fetchProfile(input: OauthExchangeInterface): Promise<OauthProfileInterface>;
}

/** The providers that are set up: a provider without its client credentials is not in the map. */
export type OauthProvidersType = ReadonlyMap<OauthProviderType, OauthProviderPort>;
