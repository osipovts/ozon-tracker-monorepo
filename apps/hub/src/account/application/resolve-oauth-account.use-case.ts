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

export interface OauthAccountResultInterface {
  user: UserInterface;
  /**
   * The account was one whose email nobody had proven, and the provider has taken it over: its
   * password is gone, and the sessions it had are the caller's to end.
   */
  claimed: boolean;
}

/**
 * Tells the user of an account of a provider: the one it is linked to, else the one of its verified
 * email, else a new one. The email is proven by the provider, so an account of that email that nobody
 * proved it for (a password account: sign-up is open) is taken over: otherwise whoever signed up with
 * somebody else's email first would keep the way in, or keep the owner out for good.
 */
export class ResolveOauthAccountUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly identities: LinkedIdentityRepositoryPort,
    private readonly registration: AccountRegistrationPort,
  ) {}

  async execute(account: OauthAccountInterface): Promise<OauthAccountResultInterface> {
    const linked = await this.linkedUser(account);
    if (linked !== null) return { user: linked, claimed: false };

    if (!account.emailVerified || account.email === null) throw new OauthEmailUnverifiedError();
    const email = UserEntity.normalizeEmail(account.email);

    const existing = await this.users.findByEmail(email);
    if (existing !== null) return this.join(existing, account);

    const user = UserEntity.registerVerified(randomUUID(), email, new Date());
    if (
      await this.registration.registerWithIdentity(user, this.identityOf(user.snapshot.id, account))
    ) {
      return { user: user.snapshot, claimed: false };
    }

    // A concurrent login got there first: with this provider account, or with this email.
    const raced = await this.linkedUser(account);
    if (raced === null) throw new EmailTakenError(email);

    return { user: raced, claimed: false };
  }

  private async join(
    existing: UserEntity,
    account: OauthAccountInterface,
  ): Promise<OauthAccountResultInterface> {
    const identity = this.identityOf(existing.snapshot.id, account);
    if (existing.snapshot.emailVerifiedAt !== null) {
      await this.identities.add(identity);

      return { user: existing.snapshot, claimed: false };
    }

    const at = new Date();
    await this.registration.claimWithIdentity(existing.snapshot.id, identity, at);

    return { user: existing.verified(at).snapshot, claimed: true };
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
