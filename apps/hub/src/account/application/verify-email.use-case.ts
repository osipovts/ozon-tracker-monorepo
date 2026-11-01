import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { hashSecretToken } from '../../shared/application/secret-token.type.js';
import type { UserInterface } from '../domain/user.entity.js';
import type { EmailVerificationRepositoryPort } from './email-verification-repository.port.js';
import { InvalidVerificationTokenError } from './invalid-verification-token.error.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly verifications: EmailVerificationRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /**
   * Proves the email of the user the link was mailed to, for that user signed in. The mailbox alone is
   * not enough: whoever signed up with somebody else's email set the password, and the owner of the
   * mailbox who opens the link without knowing it must not hand the account over. The link is not
   * spent: a mail scanner that opens it first must not leave the user with a dead one, and opening it
   * again proves nothing new.
   */
  async execute(token: string, signedInUserId: string): Promise<UserInterface> {
    const at = this.clock.now();
    const verification = await this.verifications.findByTokenHash(hashSecretToken(token));
    if (verification?.isValid(at) !== true || verification.snapshot.userId !== signedInUserId) {
      throw new InvalidVerificationTokenError();
    }

    await this.users.markEmailVerified(verification.snapshot.userId, at);
    const user = await this.users.findById(verification.snapshot.userId);
    if (user === null) throw new InvalidVerificationTokenError();

    return user.snapshot;
  }
}
