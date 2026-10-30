import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  ACCOUNT_REGISTRATION,
  type AccountRegistrationPort,
} from './application/account-registration.port.js';
import { AuthenticateWithPasswordUseCase } from './application/authenticate-with-password.use-case.js';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from './application/credential-repository.port.js';
import { GetAccountUseCase } from './application/get-account.use-case.js';
import {
  LINKED_IDENTITY_REPOSITORY,
  type LinkedIdentityRepositoryPort,
} from './application/linked-identity-repository.port.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from './application/password-hasher.port.js';
import { RegisterAccountUseCase } from './application/register-account.use-case.js';
import { USER_REPOSITORY, type UserRepositoryPort } from './application/user-repository.port.js';
import { Argon2idPasswordHasherAdapter } from './infrastructure/argon2id-password-hasher.adapter.js';
import { PrismaAccountRegistrationAdapter } from './infrastructure/prisma-account-registration.adapter.js';
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
    {
      provide: ACCOUNT_REGISTRATION,
      useFactory: (prisma: PrismaClient): AccountRegistrationPort =>
        new PrismaAccountRegistrationAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: PASSWORD_HASHER,
      useFactory: (): PasswordHasherPort => new Argon2idPasswordHasherAdapter(),
    },
    {
      provide: RegisterAccountUseCase,
      useFactory: (
        registration: AccountRegistrationPort,
        hasher: PasswordHasherPort,
      ): RegisterAccountUseCase => new RegisterAccountUseCase(registration, hasher),
      inject: [ACCOUNT_REGISTRATION, PASSWORD_HASHER],
    },
    {
      provide: AuthenticateWithPasswordUseCase,
      useFactory: (
        users: UserRepositoryPort,
        credentials: CredentialRepositoryPort,
        hasher: PasswordHasherPort,
      ): AuthenticateWithPasswordUseCase =>
        new AuthenticateWithPasswordUseCase(users, credentials, hasher),
      inject: [USER_REPOSITORY, CREDENTIAL_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: GetAccountUseCase,
      useFactory: (users: UserRepositoryPort): GetAccountUseCase => new GetAccountUseCase(users),
      inject: [USER_REPOSITORY],
    },
  ],
  exports: [RegisterAccountUseCase, AuthenticateWithPasswordUseCase, GetAccountUseCase],
})
export class AccountModule {}
