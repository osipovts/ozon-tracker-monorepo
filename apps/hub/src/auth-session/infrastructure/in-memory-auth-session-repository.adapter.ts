import type { AuthSessionRepositoryPort } from '../application/auth-session-repository.port.js';
import type { AuthSessionEntity } from '../domain/auth-session.entity.js';

export class InMemoryAuthSessionRepositoryAdapter implements AuthSessionRepositoryPort {
  private readonly sessions = new Map<string, AuthSessionEntity>();

  save(session: AuthSessionEntity): Promise<void> {
    this.sessions.set(session.snapshot.tokenHash, session);

    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null> {
    return Promise.resolve(this.sessions.get(tokenHash) ?? null);
  }
}
