import type { MarketplaceType } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';

/** An open browser window on the marketplace through one route. */
export interface SessionCaptureInterface {
  /** Resolves once the site shows its pages instead of a check. */
  waitUntilPassed(signal: AbortSignal): Promise<void>;
  export(): Promise<CapturedSessionInterface>;
  close(): Promise<void>;
}

export interface SessionCapturePort {
  /** The marketplace the windows are opened on. */
  readonly marketplace: MarketplaceType;
  /** Opens a window through the route; rejects if the route does not work. */
  open(proxy: ProxyEndpointEntity | null): Promise<SessionCaptureInterface>;
}
