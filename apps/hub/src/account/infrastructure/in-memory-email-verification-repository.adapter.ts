import type { EmailVerificationRepositoryPort } from '../application/email-verification-repository.port.js';
import type { EmailVerificationEntity } from '../domain/email-verification.entity.js';

export class InMemoryEmailVerificationRepositoryAdapter implements EmailVerificationRepositoryPort {
  private readonly verifications = new Map<string, EmailVerificationEntity>();

  replaceForUser(verification: EmailVerificationEntity): Promise<void> {
    for (const [tokenHash, { snapshot }] of this.verifications) {
      if (snapshot.userId === verification.snapshot.userId) this.verifications.delete(tokenHash);
    }
    this.verifications.set(verification.snapshot.tokenHash, verification);

    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<EmailVerificationEntity | null> {
    return Promise.resolve(this.verifications.get(tokenHash) ?? null);
  }
}
