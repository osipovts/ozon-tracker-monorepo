export interface CredentialInterface {
  userId: string;
  /** A hash of the password, never the password itself. */
  passwordHash: string;
}

/**
 * The login and password way to sign in. It is not a column of the user on purpose: a user who
 * signs in through a provider has no password, so its presence is a row instead of a NULL; the
 * hash is read only through its own port, never with the user; and other ways to sign in (a
 * passkey, a one-time code) can join it without reshaping the user.
 */
export class CredentialEntity {
  constructor(readonly snapshot: CredentialInterface) {}
}
