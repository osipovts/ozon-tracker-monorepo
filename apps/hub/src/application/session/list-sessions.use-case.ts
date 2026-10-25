import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';

export class ListSessionsUseCase {
  constructor(private readonly sessions: BrowserSessionRepositoryPort) {}

  execute(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>> {
    return this.sessions.list(pagination);
  }
}
