import type {
  ChangeAccountPasswordInterface,
  ChangeAccountPasswordUseCase,
} from '../../account/application/index.js';
import type { RevokeOtherAuthSessionsUseCase } from '../../auth-session/application/index.js';
import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';

export interface ChangePasswordInterface extends ChangeAccountPasswordInterface {
  /** The session the request came with: it stays, the others of the user end. */
  sessionId: string;
}

/** Changes the password of the user, and signs them out of every other device: one of them may not be theirs. */
export class ChangePasswordUseCase {
  constructor(
    private readonly changeAccountPassword: ChangeAccountPasswordUseCase,
    private readonly revokeOthers: RevokeOtherAuthSessionsUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limit: RateLimitInterface,
  ) {}

  async execute(input: ChangePasswordInterface): Promise<{ revokedSessions: number }> {
    // Whoever holds a stolen session can guess the current password here: the guesses are counted.
    await enforceRateLimits(this.limiter, [[`password:user:${input.userId}`, this.limit]]);

    await this.changeAccountPassword.execute(input);

    return { revokedSessions: await this.revokeOthers.execute(input.userId, input.sessionId) };
  }
}
