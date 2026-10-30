import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import { AuthSessionNotFoundError } from './auth-session-not-found.error.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

export class RevokeAuthSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** Ends a live session of the user; to anyone else it does not exist. */
  async execute(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    const at = this.clock.now();
    if (session?.snapshot.userId !== userId || !session.isActive(at)) {
      throw new AuthSessionNotFoundError(sessionId);
    }

    await this.sessions.save(session.revoked(at));
  }
}
