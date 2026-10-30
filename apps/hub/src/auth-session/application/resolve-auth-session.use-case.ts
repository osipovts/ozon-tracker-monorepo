import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { AuthSessionPolicyInterface } from '../domain/auth-session.entity.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';
import { hashSessionToken } from './session-token.type.js';

export interface AuthIdentityInterface {
  userId: string;
  sessionId: string;
}

/** Tells who a session token belongs to, and counts the use against the idle expiry of the session. */
export class ResolveAuthSessionUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly policy: AuthSessionPolicyInterface,
    private readonly clock: ClockPort = systemClock,
  ) {}

  async execute(token: string): Promise<AuthIdentityInterface | null> {
    const session = await this.sessions.findByTokenHash(hashSessionToken(token));
    const at = this.clock.now();
    if (session?.isActive(at) !== true) return null;

    await this.sessions.save(session.touched(this.policy, at));

    return { userId: session.snapshot.userId, sessionId: session.snapshot.id };
  }
}
