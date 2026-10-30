import type { UserEntity } from '../domain/user.entity.js';

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

export interface UserRepositoryPort {
  /** Registers the user unless the email is taken already; tells which one happened. */
  add(user: UserEntity): Promise<boolean>;
  /** Marks the email of the user as proven; a user who has it proven already keeps the first time. */
  markEmailVerified(userId: string, at: Date): Promise<void>;
  findById(id: string): Promise<UserEntity | null>;
  /** The email as UserEntity.normalizeEmail gives it. */
  findByEmail(email: string): Promise<UserEntity | null>;
}
