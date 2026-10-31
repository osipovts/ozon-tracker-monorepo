import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { hashSecretToken } from '../../shared/application/secret-token.type.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

export class EndAuthSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** Ending an unknown or an ended session is no error: the client is logged out either way. */
  async execute(token: string): Promise<void> {
    const session = await this.sessions.findByTokenHash(hashSecretToken(token));
    if (session === null) return;

    await this.sessions.revoke(session.snapshot.id, this.clock.now());
  }
}
