import type { UserInterface } from '../../account/application/index.js';

export interface AuthenticatedSessionInterface {
  user: UserInterface;
  /** For the cookie of the client: only its hash is kept. */
  token: string;
  /** The end of the session, which is how long the cookie may live. */
  expiresAt: Date;
}

/** Where the request came from, kept with the session so that the user can tell their devices apart. */
export interface ClientInterface {
  userAgent: string | null;
  ip: string | null;
}
