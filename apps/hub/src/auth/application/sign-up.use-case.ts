import { errorMessage, type LoggerPort, silentLogger } from 'logger';

import {
  EmailTakenError,
  normalizeEmail,
  type NotifyExistingAccountUseCase,
  type RegisterAccountInterface,
  type RegisterAccountUseCase,
  type SendEmailVerificationUseCase,
} from '../../account/application/index.js';
import { addressKeyOf } from '../../shared/application/address-key.type.js';
import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';
import type { ClientInterface } from './authenticated-session.interface.js';

export interface SignUpLimitsInterface {
  /** Sign-ups from one address. */
  register: RateLimitInterface;
  /** Notices to the holder of one email that somebody signed up with it. */
  notice: RateLimitInterface;
}

/**
 * Signs a user up by the email and the password, and mails them a link to confirm the email. It
 * says the same whether the email was free or not, and starts no session: otherwise anyone could
 * ask which emails have an account. A taken email gets a notice instead, which only its holder
 * reads. The user logs in after it. An address may sign up so many users a window.
 */
export class SignUpUseCase {
  constructor(
    private readonly registerAccount: RegisterAccountUseCase,
    private readonly sendVerification: SendEmailVerificationUseCase,
    private readonly notifyHolder: NotifyExistingAccountUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limits: SignUpLimitsInterface,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(input: RegisterAccountInterface & Pick<ClientInterface, 'ip'>): Promise<void> {
    if (input.ip !== null) {
      await enforceRateLimits(this.limiter, [
        [`register:ip:${addressKeyOf(input.ip)}`, this.limits.register],
      ]);
    }

    try {
      const user = await this.registerAccount.execute({
        email: input.email,
        password: input.password,
      });
      await this.mail((): Promise<unknown> => this.sendVerification.execute(user.id));
    } catch (error: unknown) {
      // The password was hashed all the same: the time of the answer does not tell either.
      if (!(error instanceof EmailTakenError)) throw error;

      await this.noticeHolder(input.email);
    }
  }

  /** At most one notice an interval to a holder; a refusal is silent, since a word would tell the email is taken. */
  private async noticeHolder(email: string): Promise<void> {
    const verdict = await this.limiter.hit(
      `signup-notice:email:${normalizeEmail(email)}`,
      this.limits.notice,
    );
    if (verdict.allowed) await this.mail((): Promise<unknown> => this.notifyHolder.execute(email));
  }

  /** A mail that cannot be sent is the hub's trouble: it must not fail the sign-up, nor show which email was taken. */
  private async mail(send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (error: unknown) {
      this.logger.warn(`A mail of a sign-up could not be sent: ${errorMessage(error)}`);
    }
  }
}
