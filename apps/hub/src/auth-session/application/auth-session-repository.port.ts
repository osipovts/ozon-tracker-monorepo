import type { AuthSessionEntity } from '../domain/auth-session.entity.js';

export const AUTH_SESSION_REPOSITORY = Symbol('AuthSessionRepositoryPort');

export interface AuthSessionRepositoryPort {
  /** Stores a session that has just started. */
  add(session: AuthSessionEntity): Promise<void>;
  /**
   * Moves the expiry of a live session forward. It never touches `revokedAt`: a request that read the
   * session before it was revoked must not write it back as live.
   */
  touch(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  /** Ends a session; one that is ended already keeps the time of its first revocation. */
  revoke(sessionId: string, at: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null>;
  findById(id: string): Promise<AuthSessionEntity | null>;
  /** The sessions of the user that are live at the time, the most recently used first. */
  listActiveByUser(userId: string, at: Date): Promise<AuthSessionEntity[]>;
  /** Revokes the live sessions of the user but the one to keep, if any; tells how many it revoked. */
  revokeOthers(userId: string, keepSessionId: string | null, at: Date): Promise<number>;
}
