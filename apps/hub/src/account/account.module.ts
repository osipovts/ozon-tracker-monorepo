import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from './application/credential-repository.port.js';
import {
  LINKED_IDENTITY_REPOSITORY,
  type LinkedIdentityRepositoryPort,
} from './application/linked-identity-repository.port.js';
import { USER_REPOSITORY, type UserRepositoryPort } from './application/user-repository.port.js';
import { PrismaCredentialRepositoryAdapter } from './infrastructure/prisma-credential-repository.adapter.js';
import { PrismaLinkedIdentityRepositoryAdapter } from './infrastructure/prisma-linked-identity-repository.adapter.js';
import { PrismaUserRepositoryAdapter } from './infrastructure/prisma-user-repository.adapter.js';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: USER_REPOSITORY,
      useFactory: (prisma: PrismaClient): UserRepositoryPort =>
        new PrismaUserRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: CREDENTIAL_REPOSITORY,
      useFactory: (prisma: PrismaClient): CredentialRepositoryPort =>
        new PrismaCredentialRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: LINKED_IDENTITY_REPOSITORY,
      useFactory: (prisma: PrismaClient): LinkedIdentityRepositoryPort =>
        new PrismaLinkedIdentityRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
  ],
  exports: [USER_REPOSITORY, CREDENTIAL_REPOSITORY, LINKED_IDENTITY_REPOSITORY],
})
export class AccountModule {}
