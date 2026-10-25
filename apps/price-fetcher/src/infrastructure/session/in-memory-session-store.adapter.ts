import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { SessionStorePort } from '../../application/session/session-store.port.js';
import type {
  BrowserSessionInterface,
  StorageStateInterface,
} from '../../domain/session/browser-session.interface.js';

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

function fingerprint(state: StorageStateInterface): string {
  return JSON.stringify({
    cookies: state.cookies.toSorted((a, b): number =>
      `${a.domain}|${a.path}|${a.name}`.localeCompare(`${b.domain}|${b.path}|${b.name}`),
    ),
    origins: state.origins
      .map((origin): StorageStateInterface['origins'][number] => ({
        origin: origin.origin,
        localStorage: origin.localStorage.toSorted((a, b): number => a.name.localeCompare(b.name)),
      }))
      .toSorted((a, b): number => a.origin.localeCompare(b.origin)),
  });
}

/** Holds the sessions of one job and collects what has to be reported back. */
export class InMemorySessionStoreAdapter implements SessionStorePort {
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
    const original = this.byId.get(sessionId);
    if (original === undefined || fingerprint(original.storageState) === fingerprint(storageState))
      return;
    this.updates.set(sessionId, storageState);
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
