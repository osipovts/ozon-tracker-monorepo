import type {
  RegisterAccountInterface,
  RegisterAccountUseCase,
} from '../../account/application/index.js';
import type { StartAuthSessionUseCase } from '../../auth-session/application/index.js';
import type {
  AuthenticatedSessionInterface,
  ClientInterface,
} from './authenticated-session.interface.js';

/** Signs the user up by the login and password and logs them in. */
export class SignUpUseCase {
  constructor(
    private readonly registerAccount: RegisterAccountUseCase,
    private readonly startSession: StartAuthSessionUseCase,
  ) {}

  async execute(
    input: RegisterAccountInterface & ClientInterface,
  ): Promise<AuthenticatedSessionInterface> {
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
