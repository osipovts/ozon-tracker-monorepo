import { createHash, randomBytes } from 'node:crypto';

/** A secret token (of a session, of an email link) is 256 random bits: guessing it is out of reach, so a plain hash suffices. */
export function issueSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the tables keep instead of the token: a leaked table gives no working token. */
export function hashSecretToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
