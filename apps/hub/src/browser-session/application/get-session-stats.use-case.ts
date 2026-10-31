import type {
  BrowserSessionRepositoryPort,
  BrowserSessionStatsInterface,
} from './browser-session-repository.port.js';

export type { BrowserSessionStatsInterface } from './browser-session-repository.port.js';

export class GetSessionStatsUseCase {
  constructor(private readonly sessions: BrowserSessionRepositoryPort) {}

  execute(): Promise<BrowserSessionStatsInterface> {
    return this.sessions.stats();
  }
}
