import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';

export const BROWSER_SESSION_REPOSITORY = Symbol('BrowserSessionRepositoryPort');

export interface BrowserSessionRepositoryPort {
  /** Inserts or updates the session by its id. */
  save(session: BrowserSessionEntity): Promise<void>;
  findById(id: string): Promise<BrowserSessionEntity | null>;
  findByRoute(marketplace: string, routeKey: string): Promise<BrowserSessionEntity | null>;
  /** Sessions of every status of a marketplace, the most recently updated first. */
  listByMarketplace(marketplace: string): Promise<BrowserSessionEntity[]>;
  /** Newest first. */
  list(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>>;
  /** Returns false if there was no such session. */
  delete(id: string): Promise<boolean>;
}
