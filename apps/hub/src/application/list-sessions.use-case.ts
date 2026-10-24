import type { BrowserSessionEntity } from '../domain/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';
import type { PageInterface, PaginationInterface } from './page.interface.js';

export class ListSessionsUseCase {
  constructor(private readonly sessions: BrowserSessionRepositoryPort) {}

  execute(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>> {
    return this.sessions.list(pagination);
  }
}
