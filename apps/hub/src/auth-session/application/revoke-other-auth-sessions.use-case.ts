import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

export class RevokeOtherAuthSessionsUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** Ends the live sessions of the user but the one in hand, if any; tells how many it ended. */
  execute(userId: string, keepSessionId: string | null): Promise<number> {
    return this.sessions.revokeOthers(userId, keepSessionId, this.clock.now());
  }
}
