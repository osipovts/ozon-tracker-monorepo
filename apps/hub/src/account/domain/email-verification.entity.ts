export interface EmailVerificationInterface {
  id: string;
  userId: string;
  /** The hash of the token in the link mailed to the user: a leaked table gives no working link. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export type EmailVerificationStartInterface = Pick<
  EmailVerificationInterface,
  'id' | 'userId' | 'tokenHash'
>;

/** A link mailed to the email of a user: whoever opens it has the mailbox. */
export class EmailVerificationEntity {
  constructor(readonly snapshot: EmailVerificationInterface) {}

  static issue(
    input: EmailVerificationStartInterface,
    ttlMs: number,
    at: Date,
  ): EmailVerificationEntity {
    return new EmailVerificationEntity({
      ...input,
      createdAt: at,
      expiresAt: new Date(at.getTime() + ttlMs),
    });
  }

  isValid(at: Date): boolean {
    return at < this.snapshot.expiresAt;
  }
}
