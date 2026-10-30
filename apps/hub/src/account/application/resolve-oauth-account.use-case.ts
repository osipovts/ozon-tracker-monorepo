import { randomUUID } from 'node:crypto';

import { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { OauthProviderType } from '../domain/oauth-provider.type.js';
import { UserEntity, type UserInterface } from '../domain/user.entity.js';
import type { AccountRegistrationPort } from './account-registration.port.js';
import { EmailTakenError } from './email-taken.error.js';
import type { LinkedIdentityRepositoryPort } from './linked-identity-repository.port.js';
import { OauthEmailUnverifiedError } from './oauth-email-unverified.error.js';
import type { UserRepositoryPort } from './user-repository.port.js';

export interface OauthAccountInterface {
  provider: OauthProviderType;
  /** The id of the user at the provider: stable, unlike the email. */
  subject: string;
  email: string | null;
  /** Whether the provider vouches that the email is the user's. */
  emailVerified: boolean;
}

/**
 * Tells the user of an account of a provider: the one it is linked to, else the one of its verified
 * email, else a new one. A user is joined by email only when that email is proven to be theirs, which
 * a password account's is not until it is verified: otherwise whoever signed up with somebody else's
 * email first would keep the way in after the real owner came through a provider.
 */
export class ResolveOauthAccountUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly identities: LinkedIdentityRepositoryPort,
    private readonly registration: AccountRegistrationPort,
  ) {}

  async execute(account: OauthAccountInterface): Promise<UserInterface> {
    const linked = await this.linkedUser(account);
    if (linked !== null) return linked;

    if (!account.emailVerified || account.email === null) throw new OauthEmailUnverifiedError();
    const email = UserEntity.normalizeEmail(account.email);

    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      if (existing.snapshot.emailVerifiedAt === null) throw new EmailTakenError(email);

      await this.identities.add(this.identityOf(existing.snapshot.id, account));

      return existing.snapshot;
    }

    const user = UserEntity.registerVerified(randomUUID(), email, new Date());
    if (
      await this.registration.registerWithIdentity(user, this.identityOf(user.snapshot.id, account))
    ) {
      return user.snapshot;
    }

    // A concurrent login got there first: with this provider account, or with this email.
    const raced = await this.linkedUser(account);
    if (raced === null) throw new EmailTakenError(email);

    return raced;
  }

  private async linkedUser(account: OauthAccountInterface): Promise<UserInterface | null> {
    const identity = await this.identities.findByProviderSubject(account.provider, account.subject);
    if (identity === null) return null;

    const user = await this.users.findById(identity.snapshot.userId);

    return user?.snapshot ?? null;
  }

  private identityOf(userId: string, account: OauthAccountInterface): LinkedIdentityEntity {
    return new LinkedIdentityEntity({
      id: randomUUID(),
      userId,
      provider: account.provider,
      subject: account.subject,
      createdAt: new Date(),
    });
  }
}
