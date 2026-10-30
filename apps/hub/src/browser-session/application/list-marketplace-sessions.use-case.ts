import type { BrowserSessionInterface } from '../domain/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';

export interface MarketplaceSessionInterface extends BrowserSessionInterface {
  /** Whether the marketplace still lets the session through. */
  active: boolean;
}

/** The browser sessions of a marketplace, of every status, for the contexts that route by them. */
export class ListMarketplaceSessionsUseCase {
  constructor(private readonly sessions: BrowserSessionRepositoryPort) {}

  async execute(marketplace: string): Promise<MarketplaceSessionInterface[]> {
    const sessions = await this.sessions.listByMarketplace(marketplace);

    return sessions.map((session): MarketplaceSessionInterface => ({
      ...session.snapshot,
      active: session.active,
    }));
  }
}
