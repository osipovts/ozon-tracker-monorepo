import type { MarketplaceType } from 'product-reference';

import type { BrowserSessionInterface } from './browser-session.interface.js';

/** A session captured in a browser window, ready to be stored or sent to the hub. */
export interface CapturedSessionInterface {
  marketplace: MarketplaceType;
  /** Proxy URL without credentials the session was created through; null for a direct connection. */
  proxy: string | null;
  session: BrowserSessionInterface;
  createdAt: string;
}
