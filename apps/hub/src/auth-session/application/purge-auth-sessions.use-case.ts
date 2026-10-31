import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

/** Clears out the sessions that ended: nothing reads them again, and every login adds one. */
export class PurgeAuthSessionsUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    /** How long an ended session is kept, in case someone wants to look at it. */
    private readonly retentionMs: number,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** Tells how many sessions it deleted. */
  execute(): Promise<number> {
    return this.sessions.deleteEndedBefore(new Date(this.clock.now().getTime() - this.retentionMs));
  }
}
