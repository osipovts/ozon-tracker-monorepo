import {
  AccountDeletionNotConfirmedError,
  type DeleteAccountUseCase,
  type GetAccountUseCase,
  normalizeEmail,
} from '../../account/application/index.js';
import type { RevokeOtherAuthSessionsUseCase } from '../../auth-session/application/index.js';
import type { RemoveUserProductsUseCase } from '../../product/application/index.js';

/**
 * Deletes the account of the user and everything that is theirs: the products they track (those nobody else
 * tracks go with their price history and pictures), their sessions, and the account itself. The user writes
 * the email of the account first, so that a session left open is not enough to lose it.
 */
export class CloseAccountUseCase {
  constructor(
    private readonly getAccount: Pick<GetAccountUseCase, 'execute'>,
    private readonly removeProducts: Pick<RemoveUserProductsUseCase, 'execute'>,
    private readonly revokeSessions: Pick<RevokeOtherAuthSessionsUseCase, 'execute'>,
    private readonly deleteAccount: Pick<DeleteAccountUseCase, 'execute'>,
  ) {}

  /** False when there was no such user. */
  async execute(userId: string, confirmedEmail: string): Promise<boolean> {
    const user = await this.getAccount.execute(userId);
    if (user === null) return false;
    // Before anything is deleted: a wrong email stops here, with nothing lost.
    if (normalizeEmail(confirmedEmail) !== user.email) throw new AccountDeletionNotConfirmedError();

    await this.removeProducts.execute(userId);
    await this.revokeSessions.execute(userId, null);

    return this.deleteAccount.execute(userId, confirmedEmail);
  }
}
