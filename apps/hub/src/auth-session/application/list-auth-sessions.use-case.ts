import { type ClockPort, systemClock } from '../../shared/application/clock.port.js';
import type { AuthSessionInterface } from '../domain/auth-session.entity.js';
import type { AuthSessionRepositoryPort } from './auth-session-repository.port.js';

/** What the user needs to tell their sessions apart; never the token. */
export type AuthSessionInfoInterface = Pick<
  AuthSessionInterface,
  'id' | 'userAgent' | 'ip' | 'createdAt' | 'lastSeenAt' | 'expiresAt'
>;

export class ListAuthSessionsUseCase {
  constructor(
    private readonly sessions: AuthSessionRepositoryPort,
    private readonly clock: ClockPort = systemClock,
  ) {}

  /** The live sessions of the user, the most recently used first. */
  async execute(userId: string): Promise<AuthSessionInfoInterface[]> {
    const live = await this.sessions.listActiveByUser(userId, this.clock.now());

    return live.map(({ snapshot }): AuthSessionInfoInterface => ({
      id: snapshot.id,
      userAgent: snapshot.userAgent,
      ip: snapshot.ip,
      createdAt: snapshot.createdAt,
      lastSeenAt: snapshot.lastSeenAt,
      expiresAt: snapshot.expiresAt,
    }));
  }
}
