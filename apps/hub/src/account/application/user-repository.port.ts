import type { UserEntity } from '../domain/user.entity.js';

export const USER_REPOSITORY = Symbol('UserRepositoryPort');

export interface UserRepositoryPort {
  /** Registers the user unless the email is taken already; tells which one happened. */
  add(user: UserEntity): Promise<boolean>;
  /** Marks the email of the user as proven; a user who has it proven already keeps the first time. */
  markEmailVerified(userId: string, at: Date): Promise<void>;
  /**
   * Deletes the user, and with them what is theirs: the password, the links to providers, the sessions and
   * the tracking of products (the database cascades). False if there was no such user.
   */
  delete(userId: string): Promise<boolean>;
  findById(id: string): Promise<UserEntity | null>;
  /** How many users there are, how many have the email proven, and how many joined since the time. */
  stats(joinedSince: Date): Promise<{ total: number; verified: number; joined: number }>;
  /** The email as UserEntity.normalizeEmail gives it. */
  findByEmail(email: string): Promise<UserEntity | null>;
}
