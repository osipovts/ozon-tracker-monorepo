import { type LoggerPort, silentLogger } from 'logger';

import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';
import { SessionNotFoundError } from './session-not-found.error.js';

export class DeleteSessionUseCase {
  constructor(
    private readonly sessions: BrowserSessionRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(sessionId: string): Promise<void> {
    if (!(await this.sessions.delete(sessionId))) throw new SessionNotFoundError(sessionId);
    this.logger.info(`Deleted session ${sessionId}`);
  }
}
