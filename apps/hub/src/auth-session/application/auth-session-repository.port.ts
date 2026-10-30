import type { AuthSessionEntity } from '../domain/auth-session.entity.js';

export const AUTH_SESSION_REPOSITORY = Symbol('AuthSessionRepositoryPort');

export interface AuthSessionRepositoryPort {
  save(session: AuthSessionEntity): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null>;
}
