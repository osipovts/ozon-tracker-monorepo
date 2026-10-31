import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { BrowserSessionEntity } from '../domain/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';

export class ListSessionsUseCase {
  constructor(private readonly sessions: BrowserSessionRepositoryPort) {}

  execute(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>> {
    return this.sessions.list(pagination);
  }
}
