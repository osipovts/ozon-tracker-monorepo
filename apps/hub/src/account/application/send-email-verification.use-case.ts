import { randomUUID } from 'node:crypto';

import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { MailerPort } from '../../shared/application/mailer.port.js';
import { hashSecretToken, issueSecretToken } from '../../shared/application/secret-token.type.js';
import { EmailVerificationEntity } from '../domain/email-verification.entity.js';
import type { EmailVerificationRepositoryPort } from './email-verification-repository.port.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export interface EmailVerificationOptionsInterface {
  /** Where the hub is reached from outside: the link in the mail is built on it. */
  linkBase: string;
  ttlMs: number;
}

export class SendEmailVerificationUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly verifications: EmailVerificationRepositoryPort,
    private readonly mailer: MailerPort,
    private readonly options: EmailVerificationOptionsInterface,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** Mails the user a link to prove their email; false if there is no such user or the email is proven already. */
  async execute(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (user?.snapshot.emailVerifiedAt !== null) return false;

    const token = issueSecretToken();
    await this.verifications.replaceForUser(
      EmailVerificationEntity.issue(
        { id: randomUUID(), userId, tokenHash: hashSecretToken(token) },
        this.options.ttlMs,
        this.clock.now(),
      ),
    );
    await this.mailer.send({
      to: user.snapshot.email,
      subject: 'Confirm your email',
      text:
        'Open this link to confirm that this email is yours:\n\n' +
        `${this.options.linkBase}/auth/verify-email?token=${token}\n\n` +
        'The link works for a limited time. If you did not sign up, ignore this message.',
    });

    return true;
  }
}
