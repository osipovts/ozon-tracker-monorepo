import {
  EmailTakenError,
  type RegisterAccountInterface,
  type RegisterAccountUseCase,
} from '../../account/application/index.js';
import { addressKeyOf } from '../../shared/application/address-key.type.js';
import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';
import type { ClientInterface } from './authenticated-session.interface.js';

/**
 * Signs a user up by the email and the password. It says the same whether the email was free or not,
 * and starts no session: otherwise anyone could ask which emails have an account. The user logs in
 * after it. An address may sign up so many users a window.
 */
export class SignUpUseCase {
  constructor(
    private readonly registerAccount: RegisterAccountUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limit: RateLimitInterface,
  ) {}

  async execute(input: RegisterAccountInterface & Pick<ClientInterface, 'ip'>): Promise<void> {
    if (input.ip !== null) {
      await enforceRateLimits(this.limiter, [
        [`register:ip:${addressKeyOf(input.ip)}`, this.limit],
      ]);
    }

    try {
      await this.registerAccount.execute({ email: input.email, password: input.password });
    } catch (error: unknown) {
      // The password was hashed all the same: the time of the answer does not tell either.
      if (!(error instanceof EmailTakenError)) throw error;
    }
  }
}
