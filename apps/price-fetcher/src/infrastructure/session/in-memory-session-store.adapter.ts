import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type {
  JobSessionStorePort,
  SessionMismatchInterface,
  SessionRouteInterface,
  SessionUpdateInterface,
} from '../../application/session/job-session-store.port.js';
import type {
  BrowserSessionInterface,
  StorageStateInterface,
} from '../../domain/session/browser-session.interface.js';

/** Holds the sessions of one job and collects what has to be reported back. */
export class InMemorySessionStoreAdapter implements JobSessionStorePort {
  private readonly byServer = new Map<string | null, BrowserSessionInterface>();
  private readonly byId = new Map<string, BrowserSessionInterface>();
  private readonly updates = new Map<string, StorageStateInterface>();
  private readonly mismatches = new Map<string, string>();

  constructor(routes: readonly SessionRouteInterface[]) {
    for (const route of routes) {
      this.byServer.set(route.proxy?.server ?? null, route.session);
      this.byId.set(route.session.id, route.session);
    }
  }

  find(proxy: ProxyEndpointEntity | null): BrowserSessionInterface | null {
    return this.findByServer(proxy?.server ?? null);
  }

  findByServer(server: string | null): BrowserSessionInterface | null {
    return this.byServer.get(server) ?? null;
  }

  update(sessionId: string, storageState: StorageStateInterface): void {
    if (this.byId.has(sessionId)) this.updates.set(sessionId, storageState);
  }

  reject(sessionId: string, actualIp: string): void {
    this.mismatches.set(sessionId, actualIp);
  }

  drainUpdates(): SessionUpdateInterface[] {
    const drained = Array.from(
      this.updates,
      ([sessionId, storageState]): SessionUpdateInterface => ({
        sessionId,
        storageState,
      }),
    );
    this.updates.clear();

    return drained;
  }

  drainMismatches(): SessionMismatchInterface[] {
    const drained = Array.from(
      this.mismatches,
      ([sessionId, actualIp]): SessionMismatchInterface => ({
        sessionId,
        expectedIp: this.byId.get(sessionId)?.exitIp ?? actualIp,
        actualIp,
      }),
    );
    this.mismatches.clear();

    return drained;
  }
}
