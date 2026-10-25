import type { MarketplaceType } from 'product-reference';

import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';

export interface HubSessionsPort {
  /** Alive proxies exiting in the country of the marketplace without its active session, the best first. */
  listProxiesWithoutSession(marketplace: MarketplaceType, limit: number): Promise<string[]>;
  /** After the upload the hub considers the proxy ready. */
  uploadSession(captured: CapturedSessionInterface): Promise<void>;
}
