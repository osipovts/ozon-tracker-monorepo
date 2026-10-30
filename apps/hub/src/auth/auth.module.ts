import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccountModule } from '../account/account.module.js';
import {
  AuthenticateWithPasswordUseCase,
  ChangeAccountPasswordUseCase,
  type OauthProviderType,
  RegisterAccountUseCase,
  ResolveOauthAccountUseCase,
} from '../account/application/index.js';
import {
  RevokeOtherAuthSessionsUseCase,
  StartAuthSessionUseCase,
} from '../auth-session/application/index.js';
import { AuthSessionModule } from '../auth-session/auth-session.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { ChangePasswordUseCase } from './application/change-password.use-case.js';
import { CompleteOauthLoginUseCase } from './application/complete-oauth-login.use-case.js';
import { LogInUseCase } from './application/log-in.use-case.js';
import type { OauthProviderPort, OauthProvidersType } from './application/oauth-provider.port.js';
import { SignUpUseCase } from './application/sign-up.use-case.js';
import { StartOauthLoginUseCase } from './application/start-oauth-login.use-case.js';
import { GithubOauthProviderAdapter } from './infrastructure/github-oauth-provider.adapter.js';
import { GoogleOauthProviderAdapter } from './infrastructure/google-oauth-provider.adapter.js';
import { AccessGuard } from './presentation/access.guard.js';
import { AuthController } from './presentation/auth.controller.js';
import { AuthSessionsController } from './presentation/auth-sessions.controller.js';
import { OauthController } from './presentation/oauth.controller.js';
import { OauthLoginCookieParser } from './presentation/oauth-login-cookie.parser.js';
import { OriginGuard } from './presentation/origin.guard.js';
import { SessionCookieParser } from './presentation/session-cookie.parser.js';

const OAUTH_PROVIDERS = Symbol('OauthProvidersType');

@Module({
  imports: [AccountModule, AuthSessionModule],
  controllers: [AuthController, AuthSessionsController, OauthController],
  providers: [
    {
      provide: SignUpUseCase,
      useFactory: (
        register: RegisterAccountUseCase,
        start: StartAuthSessionUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
      ): SignUpUseCase =>
        new SignUpUseCase(register, start, limiter, {
          limit: config.authRegisterMaxAttempts,
          windowMs: config.authRateLimitWindowMs,
        }),
      inject: [RegisterAccountUseCase, StartAuthSessionUseCase, RATE_LIMITER, APP_CONFIG],
    },
    {
      provide: LogInUseCase,
      useFactory: (
        authenticate: AuthenticateWithPasswordUseCase,
        start: StartAuthSessionUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
      ): LogInUseCase =>
        new LogInUseCase(authenticate, start, limiter, {
          perEmail: {
            limit: config.authLoginMaxAttempts,
            windowMs: config.authRateLimitWindowMs,
          },
          perIp: {
            limit: config.authLoginMaxAttemptsPerIp,
            windowMs: config.authRateLimitWindowMs,
          },
        }),
      inject: [AuthenticateWithPasswordUseCase, StartAuthSessionUseCase, RATE_LIMITER, APP_CONFIG],
    },
    {
      provide: ChangePasswordUseCase,
      useFactory: (
        changeAccountPassword: ChangeAccountPasswordUseCase,
        revokeOthers: RevokeOtherAuthSessionsUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
      ): ChangePasswordUseCase =>
        new ChangePasswordUseCase(changeAccountPassword, revokeOthers, limiter, {
          limit: config.authLoginMaxAttempts,
          windowMs: config.authRateLimitWindowMs,
        }),
      inject: [
        ChangeAccountPasswordUseCase,
        RevokeOtherAuthSessionsUseCase,
        RATE_LIMITER,
        APP_CONFIG,
      ],
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
    // Every route of the hub is guarded; a route says what it needs with `routeAccess`. The writes
    // are checked for their origin first, so that a foreign one is refused before it is asked who it is.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AuthModule {}
