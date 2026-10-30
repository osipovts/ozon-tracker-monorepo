import { Module } from '@nestjs/common';

import { PrismaClient } from '../generated/prisma/client.js';
import { LOGGER, type LoggerPort } from '../shared/application/logger.port.js';
import { PRISMA, PrismaModule } from '../shared/infrastructure/prisma.module.js';
import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from './application/browser-session-repository.port.js';
import { DeleteSessionUseCase } from './application/delete-session.use-case.js';
import { ImportSessionUseCase } from './application/import-session.use-case.js';
import { ListSessionsUseCase } from './application/list-sessions.use-case.js';
import { RecordSessionEventUseCase } from './application/record-session-event.use-case.js';
import { PrismaBrowserSessionRepositoryAdapter } from './infrastructure/prisma-browser-session-repository.adapter.js';
import { SessionsController } from './presentation/sessions.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [SessionsController],
  providers: [
    {
      provide: BROWSER_SESSION_REPOSITORY,
      useFactory: (prisma: PrismaClient): BrowserSessionRepositoryPort =>
        new PrismaBrowserSessionRepositoryAdapter(prisma),
      inject: [PRISMA],
    },
    {
      provide: ImportSessionUseCase,
      useFactory: (
        sessions: BrowserSessionRepositoryPort,
        logger: LoggerPort,
      ): ImportSessionUseCase => new ImportSessionUseCase(sessions, logger.child('sessions')),
      inject: [BROWSER_SESSION_REPOSITORY, LOGGER],
    },
    {
      provide: ListSessionsUseCase,
      useFactory: (sessions: BrowserSessionRepositoryPort): ListSessionsUseCase =>
        new ListSessionsUseCase(sessions),
      inject: [BROWSER_SESSION_REPOSITORY],
    },
    {
      provide: DeleteSessionUseCase,
      useFactory: (
        sessions: BrowserSessionRepositoryPort,
        logger: LoggerPort,
      ): DeleteSessionUseCase => new DeleteSessionUseCase(sessions, logger.child('sessions')),
      inject: [BROWSER_SESSION_REPOSITORY, LOGGER],
    },
    {
      provide: RecordSessionEventUseCase,
      useFactory: (
        sessions: BrowserSessionRepositoryPort,
        logger: LoggerPort,
      ): RecordSessionEventUseCase =>
        new RecordSessionEventUseCase(sessions, logger.child('sessions')),
      inject: [BROWSER_SESSION_REPOSITORY, LOGGER],
    },
  ],
  exports: [BROWSER_SESSION_REPOSITORY, RecordSessionEventUseCase],
})
export class BrowserSessionModule {}
