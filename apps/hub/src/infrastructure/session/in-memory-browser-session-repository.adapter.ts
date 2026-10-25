import type { BrowserSessionRepositoryPort } from '../../application/session/browser-session-repository.port.js';
import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../application/shared/page.interface.js';
import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';

export class InMemoryBrowserSessionRepositoryAdapter implements BrowserSessionRepositoryPort {
  private readonly sessions = new Map<string, BrowserSessionEntity>();

  save(session: BrowserSessionEntity): Promise<void> {
    this.sessions.set(session.snapshot.id, session);

    return Promise.resolve();
  }

  findById(id: string): Promise<BrowserSessionEntity | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  findByRoute(marketplace: string, routeKey: string): Promise<BrowserSessionEntity | null> {
    return Promise.resolve(
      Array.from(this.sessions.values()).find(
        (session): boolean =>
          session.snapshot.marketplace === marketplace && session.routeKey === routeKey,
      ) ?? null,
    );
  }

  listByMarketplace(marketplace: string): Promise<BrowserSessionEntity[]> {
    return Promise.resolve(
      Array.from(this.sessions.values())
        .filter((session): boolean => session.snapshot.marketplace === marketplace)
        .toSorted(
          (a, b): number => b.snapshot.updatedAt.getTime() - a.snapshot.updatedAt.getTime(),
        ),
    );
  }

  list(pagination: PaginationInterface): Promise<PageInterface<BrowserSessionEntity>> {
    const all = Array.from(this.sessions.values()).toSorted(
      (a, b): number => b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime(),
    );

    return Promise.resolve(pageOf(all, pagination));
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.sessions.delete(id));
  }
}
