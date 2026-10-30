import type {
  AuthenticateWithPasswordUseCase,
  PasswordLoginInterface,
} from '../../account/application/index.js';
import type { StartAuthSessionUseCase } from '../../auth-session/application/index.js';
import type {
  AuthenticatedSessionInterface,
  ClientInterface,
} from './authenticated-session.interface.js';

/** Logs the user in by the login and password: every login is a session of its own. */
export class LogInUseCase {
  constructor(
    private readonly authenticate: AuthenticateWithPasswordUseCase,
    private readonly startSession: StartAuthSessionUseCase,
  ) {}

  async execute(
    input: PasswordLoginInterface & ClientInterface,
  ): Promise<AuthenticatedSessionInterface> {
    const user = await this.authenticate.execute({ email: input.email, password: input.password });
    const { token, expiresAt } = await this.startSession.execute({
      userId: user.id,
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return { user, token, expiresAt };
  }
}
