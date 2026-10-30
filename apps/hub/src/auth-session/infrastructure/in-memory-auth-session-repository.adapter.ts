import type { AuthSessionRepositoryPort } from '../application/auth-session-repository.port.js';
import { AuthSessionEntity } from '../domain/auth-session.entity.js';

export class InMemoryAuthSessionRepositoryAdapter implements AuthSessionRepositoryPort {
  private readonly sessions = new Map<string, AuthSessionEntity>();

  add(session: AuthSessionEntity): Promise<void> {
    this.sessions.set(session.snapshot.tokenHash, session);

    return Promise.resolve();
  }

  touch(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    this.replace(sessionId, (session): AuthSessionEntity =>
      session.snapshot.revokedAt === null
        ? new AuthSessionEntity({ ...session.snapshot, lastSeenAt, expiresAt })
        : session,
    );

    return Promise.resolve();
  }

  revoke(sessionId: string, at: Date): Promise<void> {
    this.replace(sessionId, (session): AuthSessionEntity => session.revoked(at));

    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null> {
    return Promise.resolve(this.sessions.get(tokenHash) ?? null);
  }

  findById(id: string): Promise<AuthSessionEntity | null> {
    const session = Array.from(this.sessions.values()).find(
      ({ snapshot }): boolean => snapshot.id === id,
    );

    return Promise.resolve(session ?? null);
  }

  listActiveByUser(userId: string, at: Date): Promise<AuthSessionEntity[]> {
    const live = Array.from(this.sessions.values())
      .filter((session): boolean => session.snapshot.userId === userId && session.isActive(at))
      .toSorted(
        (a, b): number =>
          b.snapshot.lastSeenAt.getTime() - a.snapshot.lastSeenAt.getTime() ||
          b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime(),
      );

    return Promise.resolve(live);
  }

  revokeOthers(userId: string, keepSessionId: string | null, at: Date): Promise<number> {
    let revoked = 0;
    for (const [tokenHash, session] of this.sessions) {
      if (
        session.snapshot.userId === userId &&
        session.snapshot.id !== keepSessionId &&
        session.isActive(at)
      ) {
        this.sessions.set(tokenHash, session.revoked(at));
        revoked += 1;
      }
    }

    return Promise.resolve(revoked);
  }

  private replace(
    sessionId: string,
    change: (session: AuthSessionEntity) => AuthSessionEntity,
  ): void {
    for (const [tokenHash, session] of this.sessions) {
      if (session.snapshot.id === sessionId) this.sessions.set(tokenHash, change(session));
    }
  }
}
