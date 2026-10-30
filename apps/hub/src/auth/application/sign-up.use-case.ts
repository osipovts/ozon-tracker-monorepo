import type {
  RegisterAccountInterface,
  RegisterAccountUseCase,
} from '../../account/application/index.js';
import type { StartAuthSessionUseCase } from '../../auth-session/application/index.js';
import { addressKeyOf } from '../../shared/application/address-key.type.js';
import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';
import type {
  AuthenticatedSessionInterface,
  ClientInterface,
} from './authenticated-session.interface.js';

/** Signs the user up by the login and password and logs them in; an address may sign up so many a window. */
export class SignUpUseCase {
  constructor(
    private readonly registerAccount: RegisterAccountUseCase,
    private readonly startSession: StartAuthSessionUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limit: RateLimitInterface,
  ) {}

  async execute(
    input: RegisterAccountInterface & ClientInterface,
  ): Promise<AuthenticatedSessionInterface> {
    if (input.ip !== null) {
      await enforceRateLimits(this.limiter, [
        [`register:ip:${addressKeyOf(input.ip)}`, this.limit],
      ]);
    }

    const user = await this.registerAccount.execute({
      email: input.email,
      password: input.password,
    });
    const { token, expiresAt } = await this.startSession.execute({
      userId: user.id,
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return { user, token, expiresAt };
  }
}
