import type { SendEmailVerificationUseCase } from '../../account/application/index.js';
import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';

/** Mails the link to confirm the email again, to a user who lost it; only so many times a window. */
export class ResendEmailVerificationUseCase {
  constructor(
    private readonly sendVerification: SendEmailVerificationUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limit: RateLimitInterface,
  ) {}

  /** For an email that is proven already there is nothing to send, which is no error. */
  async execute(userId: string): Promise<void> {
    await enforceRateLimits(this.limiter, [[`verify-resend:user:${userId}`, this.limit]]);
    await this.sendVerification.execute(userId);
  }
}
