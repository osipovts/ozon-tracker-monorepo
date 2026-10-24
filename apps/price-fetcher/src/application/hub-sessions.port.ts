import type { MarketplaceType } from 'product-reference';

import type { CapturedSessionInterface } from '../domain/captured-session.interface.js';

export interface HubSessionsPort {
  /** Alive Russian proxies without an active session of the marketplace, the best first. */
  listProxiesWithoutSession(marketplace: MarketplaceType, limit: number): Promise<string[]>;
  /** After the upload the hub considers the proxy ready. */
  uploadSession(captured: CapturedSessionInterface): Promise<void>;
}
