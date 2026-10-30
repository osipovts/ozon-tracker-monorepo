import type { AuthSessionEntity } from '../domain/auth-session.entity.js';

export const AUTH_SESSION_REPOSITORY = Symbol('AuthSessionRepositoryPort');

export interface AuthSessionRepositoryPort {
  save(session: AuthSessionEntity): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null>;
  findById(id: string): Promise<AuthSessionEntity | null>;
  /** The sessions of the user that are live at the time, the most recently used first. */
  listActiveByUser(userId: string, at: Date): Promise<AuthSessionEntity[]>;
  /** Revokes the live sessions of the user but the one to keep; tells how many it revoked. */
  revokeOthers(userId: string, keepSessionId: string, at: Date): Promise<number>;
}
