import {
  type AuthenticateWithPasswordUseCase,
  normalizeEmail,
  type PasswordLoginInterface,
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

export interface LoginLimitsInterface {
  /** Against guessing the password of one account from one address: tight, and no one else's to spend. */
  perEmailAndIp: RateLimitInterface;
  /** Against guessing spread over many addresses; generous, or a stranger could lock the owner out. */
  perEmail: RateLimitInterface;
  /** Against trying many accounts from one address; wider, as many users may share an address. */
  perIp: RateLimitInterface;
}

/** Logs the user in by the login and password: every login is a session of its own. */
export class LogInUseCase {
  constructor(
    private readonly authenticate: AuthenticateWithPasswordUseCase,
    private readonly startSession: StartAuthSessionUseCase,
    private readonly limiter: RateLimiterPort,
    private readonly limits: LoginLimitsInterface,
  ) {}

  async execute(
    input: PasswordLoginInterface & ClientInterface,
  ): Promise<AuthenticatedSessionInterface> {
    await this.limitAttempts(input);

    const user = await this.authenticate.execute({ email: input.email, password: input.password });
    const { token, expiresAt } = await this.startSession.execute({
      userId: user.id,
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return { user, token, expiresAt };
  }

  /** Every attempt counts, the right ones too: whoever tries cannot tell the count from the answer. */
  private limitAttempts({ email, ip }: PasswordLoginInterface & ClientInterface): Promise<void> {
    const account = normalizeEmail(email);

    return enforceRateLimits(this.limiter, [
      [`login:email:${account}`, this.limits.perEmail],
      ...(ip === null
        ? []
        : ([
            [`login:email-ip:${account}|${addressKeyOf(ip)}`, this.limits.perEmailAndIp],
            [`login:ip:${addressKeyOf(ip)}`, this.limits.perIp],
          ] as const)),
    ]);
  }
}
