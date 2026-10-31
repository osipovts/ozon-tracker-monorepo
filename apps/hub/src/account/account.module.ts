import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { MAILER, type MailerPort } from '../shared/application/mailer.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  ACCOUNT_REGISTRATION,
  type AccountRegistrationPort,
} from './application/account-registration.port.js';
import { AuthenticateWithPasswordUseCase } from './application/authenticate-with-password.use-case.js';
import { ChangeAccountPasswordUseCase } from './application/change-account-password.use-case.js';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from './application/credential-repository.port.js';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  type EmailVerificationRepositoryPort,
} from './application/email-verification-repository.port.js';
import { GetAccountUseCase } from './application/get-account.use-case.js';
import { GetUserStatsUseCase } from './application/get-user-stats.use-case.js';
import {
  LINKED_IDENTITY_REPOSITORY,
  type LinkedIdentityRepositoryPort,
} from './application/linked-identity-repository.port.js';
import { NotifyExistingAccountUseCase } from './application/notify-existing-account.use-case.js';
import { PASSWORD_HASHER, type PasswordHasherPort } from './application/password-hasher.port.js';
import { RegisterAccountUseCase } from './application/register-account.use-case.js';
import { ResolveOauthAccountUseCase } from './application/resolve-oauth-account.use-case.js';
import { SendEmailVerificationUseCase } from './application/send-email-verification.use-case.js';
import { USER_REPOSITORY, type UserRepositoryPort } from './application/user-repository.port.js';
import { VerifyEmailUseCase } from './application/verify-email.use-case.js';
import { Argon2idPasswordHasherAdapter } from './infrastructure/argon2id-password-hasher.adapter.js';
import { PrismaAccountRegistrationAdapter } from './infrastructure/prisma-account-registration.adapter.js';
import { PrismaCredentialRepositoryAdapter } from './infrastructure/prisma-credential-repository.adapter.js';
import { PrismaEmailVerificationRepositoryAdapter } from './infrastructure/prisma-email-verification-repository.adapter.js';
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
      provide: ChangeAccountPasswordUseCase,
      useFactory: (
        credentials: CredentialRepositoryPort,
        hasher: PasswordHasherPort,
      ): ChangeAccountPasswordUseCase => new ChangeAccountPasswordUseCase(credentials, hasher),
      inject: [CREDENTIAL_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: ResolveOauthAccountUseCase,
      useFactory: (
        users: UserRepositoryPort,
        identities: LinkedIdentityRepositoryPort,
        registration: AccountRegistrationPort,
      ): ResolveOauthAccountUseCase =>
        new ResolveOauthAccountUseCase(users, identities, registration),
      inject: [USER_REPOSITORY, LINKED_IDENTITY_REPOSITORY, ACCOUNT_REGISTRATION],
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useFactory: (prisma: PrismaClient): EmailVerificationRepositoryPort =>
        new PrismaEmailVerificationRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: SendEmailVerificationUseCase,
      useFactory: (
        users: UserRepositoryPort,
        verifications: EmailVerificationRepositoryPort,
        mailer: MailerPort,
        config: AppConfigInterface,
      ): SendEmailVerificationUseCase =>
        new SendEmailVerificationUseCase(users, verifications, mailer, {
          linkBase: config.publicUrl,
          ttlMs: config.emailVerificationTtlMs,
        }),
      inject: [USER_REPOSITORY, EMAIL_VERIFICATION_REPOSITORY, MAILER, APP_CONFIG],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (
        users: UserRepositoryPort,
        verifications: EmailVerificationRepositoryPort,
      ): VerifyEmailUseCase => new VerifyEmailUseCase(users, verifications),
      inject: [USER_REPOSITORY, EMAIL_VERIFICATION_REPOSITORY],
    },
    {
      provide: NotifyExistingAccountUseCase,
      useFactory: (mailer: MailerPort): NotifyExistingAccountUseCase =>
        new NotifyExistingAccountUseCase(mailer),
      inject: [MAILER],
    },
    {
      provide: GetUserStatsUseCase,
      useFactory: (users: UserRepositoryPort): GetUserStatsUseCase =>
        new GetUserStatsUseCase(users),
      inject: [USER_REPOSITORY],
    },
    {
      provide: GetAccountUseCase,
      useFactory: (users: UserRepositoryPort): GetAccountUseCase => new GetAccountUseCase(users),
      inject: [USER_REPOSITORY],
    },
  ],
  exports: [
    RegisterAccountUseCase,
    AuthenticateWithPasswordUseCase,
    ChangeAccountPasswordUseCase,
    ResolveOauthAccountUseCase,
    SendEmailVerificationUseCase,
    VerifyEmailUseCase,
    NotifyExistingAccountUseCase,
    GetUserStatsUseCase,
    GetAccountUseCase,
  ],
})
export class AccountModule {}
