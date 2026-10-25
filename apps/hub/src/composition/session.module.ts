import { Module } from '@nestjs/common';

import {
  BROWSER_SESSION_REPOSITORY,
  type BrowserSessionRepositoryPort,
} from '../application/session/browser-session-repository.port.js';
import { DeleteSessionUseCase } from '../application/session/delete-session.use-case.js';
import { ImportSessionUseCase } from '../application/session/import-session.use-case.js';
import { ListSessionsUseCase } from '../application/session/list-sessions.use-case.js';
import { RecordSessionEventUseCase } from '../application/session/record-session-event.use-case.js';
import { LOGGER, type LoggerPort } from '../application/shared/logger.port.js';
import { SessionsController } from '../presentation/session/sessions.controller.js';
import { PersistenceModule } from './persistence.module.js';

@Module({
  imports: [PersistenceModule],
  controllers: [SessionsController],
  providers: [
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
  exports: [RecordSessionEventUseCase],
})
export class SessionModule {}
