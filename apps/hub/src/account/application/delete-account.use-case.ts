import { UserEntity } from '../domain/user.entity.js';
import { AccountDeletionNotConfirmedError } from './account-deletion-not-confirmed.error.js';
import type { UserRepositoryPort } from './user-repository.port.js';

/**
 * Deletes the account of the user for good, with the password, the links to providers, the sessions and the
 * tracking of products (the database cascades), once the user has written the email of the account.
 */
export class DeleteAccountUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  /** False when there was no such user. */
  async execute(userId: string, confirmedEmail: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (user === null) return false;

    if (UserEntity.normalizeEmail(confirmedEmail) !== user.snapshot.email) {
      throw new AccountDeletionNotConfirmedError();
    }

    return this.users.delete(userId);
  }
}
