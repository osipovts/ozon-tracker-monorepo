import type { EmailVerificationEntity } from '../domain/email-verification.entity.js';

export const EMAIL_VERIFICATION_REPOSITORY = Symbol('EmailVerificationRepositoryPort');

export interface EmailVerificationRepositoryPort {
  /** Keeps one link per user: the earlier ones stop working. */
  replaceForUser(verification: EmailVerificationEntity): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationEntity | null>;
}
