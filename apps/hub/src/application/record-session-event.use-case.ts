import { type LoggerPort, silentLogger } from 'logger';

import type { BrowserSessionEntity } from '../domain/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';
import type { SessionEventInterface } from './session-event.interface.js';

export class RecordSessionEventUseCase {
  constructor(
    private readonly sessions: BrowserSessionRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(event: SessionEventInterface): Promise<void> {
    const session = await this.sessions.findById(event.sessionId);
    if (session === null) {
      // The session may have been replaced or deleted while the job was running.
      this.logger.debug(`Ignoring a ${event.type} event of the unknown session ${event.sessionId}`);
      return;
    }
    await this.sessions.save(this.apply(session, event));
    this.logger.verbose(`Session ${event.sessionId}: ${event.type}`);
    if (event.type === 'stale')
      this.logger.warn(`Session ${event.sessionId} is stale (${event.reason}); create a new one`);
  }

  private apply(session: BrowserSessionEntity, event: SessionEventInterface): BrowserSessionEntity {
    switch (event.type) {
      case 'refreshed':
        return session.withState(event.storageState, event.at);
      case 'stale':
        return session.markedStale(event.reason, event.at);
      case 'used':
        return session.markedUsed(event.at);
    }
  }
}
