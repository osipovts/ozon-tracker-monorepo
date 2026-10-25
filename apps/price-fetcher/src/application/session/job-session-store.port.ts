import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type {
  BrowserSessionInterface,
  StorageStateInterface,
} from '../../domain/session/browser-session.interface.js';
import type { SessionStorePort } from './session-store.port.js';

export interface SessionRouteInterface {
  proxy: ProxyEndpointEntity | null;
  session: BrowserSessionInterface;
}

export interface SessionUpdateInterface {
  sessionId: string;
  storageState: StorageStateInterface;
}

export interface SessionMismatchInterface {
  sessionId: string;
  expectedIp: string;
  actualIp: string;
}

/** The sessions of one job; it collects what has to be reported back once the job is done. */
export interface JobSessionStorePort extends SessionStorePort {
  /** The session bound to the route; a null server is a direct connection. */
  findByServer(server: string | null): BrowserSessionInterface | null;
  drainUpdates(): SessionUpdateInterface[];
  drainMismatches(): SessionMismatchInterface[];
}
