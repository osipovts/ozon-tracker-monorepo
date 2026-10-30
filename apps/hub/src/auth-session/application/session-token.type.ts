import { createHash, randomBytes } from 'node:crypto';

/** A session token is 256 random bits: guessing it is out of reach, so a plain hash suffices. */
export function issueSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the session table keeps instead of the token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
