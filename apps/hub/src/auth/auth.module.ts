import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccountModule } from '../account/account.module.js';
import {
  AuthenticateWithPasswordUseCase,
  ChangeAccountPasswordUseCase,
  DeleteAccountUseCase,
  GetAccountUseCase,
  NotifyExistingAccountUseCase,
  type OauthProviderType,
  RegisterAccountUseCase,
  ResolveOauthAccountUseCase,
  SendEmailVerificationUseCase,
} from '../account/application/index.js';
import {
  RevokeOtherAuthSessionsUseCase,
  StartAuthSessionUseCase,
} from '../auth-session/application/index.js';
import { AuthSessionModule } from '../auth-session/auth-session.module.js';
import { RemoveUserProductsUseCase } from '../product/application/index.js';
import { ProductModule } from '../product/product.module.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { RATE_LIMITER, type RateLimiterPort } from '../shared/application/rate-limiter.port.js';
import { ChangePasswordUseCase } from './application/change-password.use-case.js';
import { CloseAccountUseCase } from './application/close-account.use-case.js';
import { CompleteOauthLoginUseCase } from './application/complete-oauth-login.use-case.js';
import { ListOauthProvidersUseCase } from './application/list-oauth-providers.use-case.js';
import { LogInUseCase } from './application/log-in.use-case.js';
import type { OauthProviderPort, OauthProvidersType } from './application/oauth-provider.port.js';
import { ResendEmailVerificationUseCase } from './application/resend-email-verification.use-case.js';
import { SignUpUseCase } from './application/sign-up.use-case.js';
import { StartOauthLoginUseCase } from './application/start-oauth-login.use-case.js';
import { GithubOauthProviderAdapter } from './infrastructure/github-oauth-provider.adapter.js';
import { GoogleOauthProviderAdapter } from './infrastructure/google-oauth-provider.adapter.js';
import { AccessGuard } from './presentation/access.guard.js';
import { AccountController } from './presentation/account.controller.js';
import { AuthController } from './presentation/auth.controller.js';
import { AuthSessionsController } from './presentation/auth-sessions.controller.js';
import { EmailVerificationController } from './presentation/email-verification.controller.js';
import { OauthController } from './presentation/oauth.controller.js';
import { OauthLoginCookieParser } from './presentation/oauth-login-cookie.parser.js';
import { OriginGuard } from './presentation/origin.guard.js';
import { SessionCookieParser } from './presentation/session-cookie.parser.js';

/** The providers of the login, by name; a test of the whole hub swaps it for adapters of a provider it runs. */
export const OAUTH_PROVIDERS = Symbol('OauthProvidersType');

/** The holder of an email is told at most this often that somebody signed up with it. */
const noticeIntervalMs = 60 * 60_000;

@Module({
  imports: [AccountModule, AuthSessionModule, ProductModule],
  controllers: [
    AccountController,
    AuthController,
    AuthSessionsController,
    EmailVerificationController,
    OauthController,
  ],
  providers: [
    {
      provide: SignUpUseCase,
      useFactory: (
        register: RegisterAccountUseCase,
        sendVerification: SendEmailVerificationUseCase,
        notifyHolder: NotifyExistingAccountUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
        logger: LoggerPort,
      ): SignUpUseCase =>
        new SignUpUseCase(
          register,
          sendVerification,
          notifyHolder,
          limiter,
          {
            register: {
              limit: config.authRegisterMaxAttempts,
              windowMs: config.authRateLimitWindowMs,
            },
            notice: { limit: 1, windowMs: noticeIntervalMs },
          },
          logger.child('sign-up'),
        ),
      inject: [
        RegisterAccountUseCase,
        SendEmailVerificationUseCase,
        NotifyExistingAccountUseCase,
        RATE_LIMITER,
        APP_CONFIG,
        LOGGER,
      ],
    },
    {
      provide: ResendEmailVerificationUseCase,
      useFactory: (
        sendVerification: SendEmailVerificationUseCase,
        limiter: RateLimiterPort,
        config: AppConfigInterface,
      ): ResendEmailVerificationUseCase =>
        new ResendEmailVerificationUseCase(sendVerification, limiter, {
          limit: config.authVerificationResendMaxAttempts,
          windowMs: config.authRateLimitWindowMs,
        }),
      inject: [SendEmailVerificationUseCase, RATE_LIMITER, APP_CONFIG],
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
          perEmailAndIp: {
            limit: config.authLoginMaxAttempts,
            windowMs: config.authRateLimitWindowMs,
          },
          perEmail: {
            limit: config.authLoginMaxAttemptsPerEmail,
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
      provide: CloseAccountUseCase,
      useFactory: (
        accounts: GetAccountUseCase,
        products: RemoveUserProductsUseCase,
        sessions: RevokeOtherAuthSessionsUseCase,
        deletion: DeleteAccountUseCase,
      ): CloseAccountUseCase => new CloseAccountUseCase(accounts, products, sessions, deletion),
      inject: [
        GetAccountUseCase,
        RemoveUserProductsUseCase,
        RevokeOtherAuthSessionsUseCase,
        DeleteAccountUseCase,
      ],
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
      useFactory: (config: AppConfigInterface, logger: LoggerPort): OauthProvidersType => {
        const providers = new Map<OauthProviderType, OauthProviderPort>();
        if (config.googleOauth !== null) {
          providers.set('google', new GoogleOauthProviderAdapter(config.googleOauth));
        }
        if (config.githubOauth !== null) {
          providers.set(
            'github',
            new GithubOauthProviderAdapter(config.githubOauth, undefined, logger.child('github')),
          );
        }

        return providers;
      },
      inject: [APP_CONFIG, LOGGER],
    },
    {
      provide: ListOauthProvidersUseCase,
      useFactory: (providers: OauthProvidersType): ListOauthProvidersUseCase =>
        new ListOauthProvidersUseCase(providers),
      inject: [OAUTH_PROVIDERS],
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
        revokeSessions: RevokeOtherAuthSessionsUseCase,
      ): CompleteOauthLoginUseCase =>
        new CompleteOauthLoginUseCase(providers, resolveAccount, start, revokeSessions),
      inject: [
        OAUTH_PROVIDERS,
        ResolveOauthAccountUseCase,
        StartAuthSessionUseCase,
        RevokeOtherAuthSessionsUseCase,
      ],
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
