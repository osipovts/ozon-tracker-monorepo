import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type {
  BrowserSessionInterface,
  StorageStateInterface,
} from '../../domain/session/browser-session.interface.js';

export interface SessionStorePort {
  /** The session bound to the route; a null proxy is a direct connection. */
  find(proxy: ProxyEndpointEntity | null): BrowserSessionInterface | null;
  /** Stores the state after a successful read; the cookies may have been refreshed. */
  update(sessionId: string, storageState: StorageStateInterface): void;
  /** The route exits through another address than the session was created with. */
  reject(sessionId: string, actualIp: string): void;
}
