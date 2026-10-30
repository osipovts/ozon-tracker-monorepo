import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AccountRegistrationPort } from '../application/account-registration.port.js';
import type { CredentialEntity } from '../domain/credential.entity.js';
import type { LinkedIdentityEntity } from '../domain/linked-identity.entity.js';
import type { UserEntity } from '../domain/user.entity.js';

export class PrismaAccountRegistrationAdapter implements AccountRegistrationPort {
  constructor(private readonly prisma: PrismaClient) {}

  registerWithPassword(user: UserEntity, credential: CredentialEntity): Promise<boolean> {
    return this.prisma.$transaction(async (tx): Promise<boolean> => {
      // Skipping a duplicate instead of reading first keeps concurrent sign-ups apart.
      const { count } = await tx.user.createMany({ data: [user.snapshot], skipDuplicates: true });
      if (count === 0) return false;

      await tx.credential.create({ data: credential.snapshot });

      return true;
    });
  }

  registerWithIdentity(user: UserEntity, identity: LinkedIdentityEntity): Promise<boolean> {
    return this.prisma.$transaction(async (tx): Promise<boolean> => {
      const { count } = await tx.user.createMany({ data: [user.snapshot], skipDuplicates: true });
      if (count === 0) return false;

      // A concurrent login of the same provider account may have linked it already: that is fine.
      await tx.linkedIdentity.createMany({ data: [identity.snapshot], skipDuplicates: true });

      return true;
    });
  }
}
