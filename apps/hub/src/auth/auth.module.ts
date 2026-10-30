import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccountModule } from '../account/account.module.js';
import {
  AuthenticateWithPasswordUseCase,
  type OauthProviderType,
  RegisterAccountUseCase,
  ResolveOauthAccountUseCase,
} from '../account/application/index.js';
import { StartAuthSessionUseCase } from '../auth-session/application/index.js';
import { AuthSessionModule } from '../auth-session/auth-session.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { CompleteOauthLoginUseCase } from './application/complete-oauth-login.use-case.js';
import { LogInUseCase } from './application/log-in.use-case.js';
import type { OauthProviderPort, OauthProvidersType } from './application/oauth-provider.port.js';
import { SignUpUseCase } from './application/sign-up.use-case.js';
import { StartOauthLoginUseCase } from './application/start-oauth-login.use-case.js';
import { GithubOauthProviderAdapter } from './infrastructure/github-oauth-provider.adapter.js';
import { GoogleOauthProviderAdapter } from './infrastructure/google-oauth-provider.adapter.js';
import { AccessGuard } from './presentation/access.guard.js';
import { AuthController } from './presentation/auth.controller.js';
import { OauthController } from './presentation/oauth.controller.js';
import { OauthLoginCookieParser } from './presentation/oauth-login-cookie.parser.js';
import { SessionCookieParser } from './presentation/session-cookie.parser.js';

const OAUTH_PROVIDERS = Symbol('OauthProvidersType');

@Module({
  imports: [AccountModule, AuthSessionModule],
  controllers: [AuthController, OauthController],
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
    {
      // A provider whose OAuth app is not set up is left out: its login is off.
      provide: OAUTH_PROVIDERS,
      useFactory: (config: AppConfigInterface): OauthProvidersType => {
        const providers = new Map<OauthProviderType, OauthProviderPort>();
        if (config.googleOauth !== null) {
          providers.set('google', new GoogleOauthProviderAdapter(config.googleOauth));
        }
        if (config.githubOauth !== null) {
          providers.set('github', new GithubOauthProviderAdapter(config.githubOauth));
        }

        return providers;
      },
      inject: [APP_CONFIG],
    },
    {
      provide: StartOauthLoginUseCase,
      useFactory: (providers: OauthProvidersType): StartOauthLoginUseCase =>
        new StartOauthLoginUseCase(providers),
      inject: [OAUTH_PROVIDERS],
    },
    {
      provide: CompleteOauthLoginUseCase,
      useFactory: (
        providers: OauthProvidersType,
        resolveAccount: ResolveOauthAccountUseCase,
        start: StartAuthSessionUseCase,
      ): CompleteOauthLoginUseCase =>
        new CompleteOauthLoginUseCase(providers, resolveAccount, start),
      inject: [OAUTH_PROVIDERS, ResolveOauthAccountUseCase, StartAuthSessionUseCase],
    },
    SessionCookieParser,
    OauthLoginCookieParser,
    // Every route of the hub is guarded; a route says what it needs with `routeAccess`.
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AuthModule {}
