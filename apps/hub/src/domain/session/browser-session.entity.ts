export interface StorageStateInterface {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export type SessionStatusType = 'active' | 'stale';

export interface BrowserSessionInterface {
  id: string;
  marketplace: string;
  /** Proxy URL without credentials the session was created through; null for a direct connection. */
  proxyServer: string | null;
  exitIp: string;
  userAgent: string;
  platform: string;
  browserVersion: string;
  storageState: StorageStateInterface;
  status: SessionStatusType;
  staleReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

/** A browser session of a marketplace, valid only on the exit address it was created with. */
export class BrowserSessionEntity {
  constructor(readonly snapshot: BrowserSessionInterface) {}

  /** A marketplace has one session per route. */
  get routeKey(): string {
    return BrowserSessionEntity.routeKeyOf(this.snapshot.proxyServer);
  }

  static routeKeyOf(proxyServer: string | null): string {
    return proxyServer ?? 'direct';
  }

  get active(): boolean {
    return this.snapshot.status === 'active';
  }

  withState(storageState: StorageStateInterface, at: Date): BrowserSessionEntity {
    return new BrowserSessionEntity({ ...this.snapshot, storageState, updatedAt: at });
  }

  markedStale(reason: string, at: Date): BrowserSessionEntity {
    return new BrowserSessionEntity({
      ...this.snapshot,
      status: 'stale',
      staleReason: reason,
      updatedAt: at,
    });
  }

  markedUsed(at: Date): BrowserSessionEntity {
    return new BrowserSessionEntity({ ...this.snapshot, lastUsedAt: at });
  }
}
