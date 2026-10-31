import { createHash, randomBytes } from 'node:crypto';

export interface OauthChallengeInterface {
  /** Goes to the provider and comes back with the code. */
  state: string;
  /** Stays with the browser of the user until the callback. */
  codeVerifier: string;
  /** The S256 challenge of the verifier, as the PKCE of RFC 7636 has it. */
  codeChallenge: string;
}

export function createOauthChallenge(): OauthChallengeInterface {
  const codeVerifier = randomBytes(32).toString('base64url');

  return {
    state: randomBytes(24).toString('base64url'),
    codeVerifier,
    codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
  };
}
