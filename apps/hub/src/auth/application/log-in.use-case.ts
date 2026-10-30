import {
  type AuthenticateWithPasswordUseCase,
  normalizeEmail,
  type PasswordLoginInterface,
} from '../../account/application/index.js';
import type { StartAuthSessionUseCase } from '../../auth-session/application/index.js';
import type {
  RateLimiterPort,
  RateLimitInterface,
} from '../../shared/application/rate-limiter.port.js';
import { TooManyRequestsError } from '../../shared/application/too-many-requests.error.js';
import type {
  AuthenticatedSessionInterface,
  ClientInterface,
} from './authenticated-session.interface.js';

export interface LoginLimitsInterface {
  /** Against guessing the password of one account, from wherever. */
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
  private async limitAttempts({
    email,
    ip,
  }: PasswordLoginInterface & ClientInterface): Promise<void> {
    const verdicts = [
      await this.limiter.hit(`login:email:${normalizeEmail(email)}`, this.limits.perEmail),
      ...(ip === null ? [] : [await this.limiter.hit(`login:ip:${ip}`, this.limits.perIp)]),
    ];

    const refused = verdicts.filter((verdict): boolean => !verdict.allowed);
    if (refused.length > 0) {
      throw new TooManyRequestsError(
        Math.max(...refused.map((verdict): number => verdict.retryAfterMs)),
      );
    }
  }
}
