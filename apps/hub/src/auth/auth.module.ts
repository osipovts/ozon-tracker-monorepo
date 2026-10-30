import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccountModule } from '../account/account.module.js';
import {
  AuthenticateWithPasswordUseCase,
  RegisterAccountUseCase,
} from '../account/application/index.js';
import { StartAuthSessionUseCase } from '../auth-session/application/index.js';
import { AuthSessionModule } from '../auth-session/auth-session.module.js';
import { LogInUseCase } from './application/log-in.use-case.js';
import { SignUpUseCase } from './application/sign-up.use-case.js';
import { AccessGuard } from './presentation/access.guard.js';
import { AuthController } from './presentation/auth.controller.js';
import { SessionCookieParser } from './presentation/session-cookie.parser.js';

@Module({
  imports: [AccountModule, AuthSessionModule],
  controllers: [AuthController],
  providers: [
    {
      provide: SignUpUseCase,
      useFactory: (
        register: RegisterAccountUseCase,
        start: StartAuthSessionUseCase,
      ): SignUpUseCase => new SignUpUseCase(register, start),
      inject: [RegisterAccountUseCase, StartAuthSessionUseCase],
    },
    {
      provide: LogInUseCase,
      useFactory: (
        authenticate: AuthenticateWithPasswordUseCase,
        start: StartAuthSessionUseCase,
      ): LogInUseCase => new LogInUseCase(authenticate, start),
      inject: [AuthenticateWithPasswordUseCase, StartAuthSessionUseCase],
    },
    SessionCookieParser,
    // Every route of the hub is guarded; a route says what it needs with `routeAccess`.
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AuthModule {}
