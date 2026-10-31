import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { APP_CONFIG, type AppConfigInterface } from '../shared/application/app-config.interface.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepositoryPort,
} from './application/auth-session-repository.port.js';
import { EndAuthSessionUseCase } from './application/end-auth-session.use-case.js';
import { ListAuthSessionsUseCase } from './application/list-auth-sessions.use-case.js';
import { PurgeAuthSessionsUseCase } from './application/purge-auth-sessions.use-case.js';
import { ResolveAuthSessionUseCase } from './application/resolve-auth-session.use-case.js';
import { RevokeAuthSessionUseCase } from './application/revoke-auth-session.use-case.js';
import { RevokeOtherAuthSessionsUseCase } from './application/revoke-other-auth-sessions.use-case.js';
import { StartAuthSessionUseCase } from './application/start-auth-session.use-case.js';
import type { AuthSessionPolicyInterface } from './domain/auth-session.entity.js';
import { PeriodicAuthSessionPurgeAdapter } from './infrastructure/periodic-auth-session-purge.adapter.js';
import { PrismaAuthSessionRepositoryAdapter } from './infrastructure/prisma-auth-session-repository.adapter.js';

const AUTH_SESSION_POLICY = Symbol('AuthSessionPolicyInterface');

/** An ended session is kept this long, then purged. */
const endedSessionRetentionMs = 24 * 60 * 60_000;

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AUTH_SESSION_REPOSITORY,
      useFactory: (prisma: PrismaClient): AuthSessionRepositoryPort =>
        new PrismaAuthSessionRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: AUTH_SESSION_POLICY,
      useFactory: (config: AppConfigInterface): AuthSessionPolicyInterface => ({
        idleTtlMs: config.authSessionIdleTtlMs,
        absoluteTtlMs: config.authSessionAbsoluteTtlMs,
      }),
      inject: [APP_CONFIG],
    },
    {
      provide: StartAuthSessionUseCase,
      useFactory: (
        sessions: AuthSessionRepositoryPort,
        policy: AuthSessionPolicyInterface,
      ): StartAuthSessionUseCase => new StartAuthSessionUseCase(sessions, policy),
      inject: [AUTH_SESSION_REPOSITORY, AUTH_SESSION_POLICY],
    },
    {
      provide: ResolveAuthSessionUseCase,
      useFactory: (
        sessions: AuthSessionRepositoryPort,
        policy: AuthSessionPolicyInterface,
      ): ResolveAuthSessionUseCase => new ResolveAuthSessionUseCase(sessions, policy),
      inject: [AUTH_SESSION_REPOSITORY, AUTH_SESSION_POLICY],
    },
    {
      provide: ListAuthSessionsUseCase,
      useFactory: (sessions: AuthSessionRepositoryPort): ListAuthSessionsUseCase =>
        new ListAuthSessionsUseCase(sessions),
      inject: [AUTH_SESSION_REPOSITORY],
    },
    {
      provide: RevokeAuthSessionUseCase,
      useFactory: (sessions: AuthSessionRepositoryPort): RevokeAuthSessionUseCase =>
        new RevokeAuthSessionUseCase(sessions),
      inject: [AUTH_SESSION_REPOSITORY],
    },
    {
      provide: RevokeOtherAuthSessionsUseCase,
      useFactory: (sessions: AuthSessionRepositoryPort): RevokeOtherAuthSessionsUseCase =>
        new RevokeOtherAuthSessionsUseCase(sessions),
      inject: [AUTH_SESSION_REPOSITORY],
    },
    {
      provide: PurgeAuthSessionsUseCase,
      useFactory: (sessions: AuthSessionRepositoryPort): PurgeAuthSessionsUseCase =>
        new PurgeAuthSessionsUseCase(sessions, endedSessionRetentionMs),
      inject: [AUTH_SESSION_REPOSITORY],
    },
    {
      provide: PeriodicAuthSessionPurgeAdapter,
      useFactory: (
        purge: PurgeAuthSessionsUseCase,
        config: AppConfigInterface,
        logger: LoggerPort,
      ): PeriodicAuthSessionPurgeAdapter =>
        new PeriodicAuthSessionPurgeAdapter(
          purge,
          config.authSessionPurgeIntervalMs,
          logger.child('auth-sessions'),
        ),
      inject: [PurgeAuthSessionsUseCase, APP_CONFIG, LOGGER],
    },
    {
      provide: EndAuthSessionUseCase,
      useFactory: (sessions: AuthSessionRepositoryPort): EndAuthSessionUseCase =>
        new EndAuthSessionUseCase(sessions),
      inject: [AUTH_SESSION_REPOSITORY],
    },
  ],
  exports: [
    StartAuthSessionUseCase,
    ResolveAuthSessionUseCase,
    EndAuthSessionUseCase,
    ListAuthSessionsUseCase,
    RevokeAuthSessionUseCase,
    RevokeOtherAuthSessionsUseCase,
  ],
})
export class AuthSessionModule {}
