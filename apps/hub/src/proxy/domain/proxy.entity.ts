import type { ProxyCheckInterface } from './proxy-check.interface.js';

/** The source of the proxies an administrator added by hand: they go before the found ones. */
export const manualProxySource = 'manual';

export interface ProxyCredentialsInterface {
  username: string;
  password: string;
}

export interface ProxyInterface {
  /** Proxy URL without credentials. */
  server: string;
  source: string;
  country: string | null;
  exitIp: string | null;
  alive: boolean;
  /** Latency of the last successful check. */
  latencyMs: number | null;
  checksTotal: number;
  checksAlive: number;
  lastCheckedAt: Date;
  /** When an administrator turned the proxy off: the workers are not given it, and a check does not turn it on. */
  disabledAt: Date | null;
  /** Kept apart from the server, which is listed and keys the sessions; null for a proxy without them. */
  credentials: ProxyCredentialsInterface | null;
}

/** A check that found the proxy alive tells its values; a dead one leaves the last known ones. */
function latest<Value>(
  alive: boolean,
  fresh: Value | null,
  known: Value | null | undefined,
): Value | null {
  return alive ? fresh : (known ?? null);
}

export class ProxyEntity {
  constructor(readonly snapshot: ProxyInterface) {}

  get successRate(): number {
    const { checksTotal, checksAlive } = this.snapshot;

    return checksTotal === 0 ? 0 : checksAlive / checksTotal;
  }

  get isManual(): boolean {
    return this.snapshot.source === manualProxySource;
  }

  /** The address the workers connect to: the server with the credentials, if it has them. */
  get routeUrl(): string {
    const { server, credentials } = this.snapshot;
    if (credentials === null) return server;

    const url = new URL(server);
    url.username = credentials.username;
    url.password = credentials.password;

    return url.toString();
  }

  /** Turned off as of the time; one that is off already keeps the first time. */
  disabled(at: Date): ProxyEntity {
    return new ProxyEntity({ ...this.snapshot, disabledAt: this.snapshot.disabledAt ?? at });
  }

  enabled(): ProxyEntity {
    return new ProxyEntity({ ...this.snapshot, disabledAt: null });
  }

  /** Added by hand: the administrator vouches for it, so it counts as alive until a check says otherwise. */
  static manual(
    server: string,
    credentials: ProxyCredentialsInterface | null,
    at: Date,
    previous?: ProxyEntity,
  ): ProxyEntity {
    return new ProxyEntity({
      server,
      country: null,
      exitIp: null,
      alive: true,
      latencyMs: null,
      checksTotal: 0,
      checksAlive: 0,
      lastCheckedAt: at,
      disabledAt: null,
      ...previous?.snapshot,
      credentials,
      source: manualProxySource,
    });
  }

  static fromCheck(check: ProxyCheckInterface, previous?: ProxyEntity): ProxyEntity {
    const known = previous?.snapshot;

    return new ProxyEntity({
      server: check.server,
      // A found proxy that was added by hand stays manual.
      source: known?.source === manualProxySource ? manualProxySource : check.source,
      country: latest(check.alive, check.country, known?.country),
      exitIp: latest(check.alive, check.exitIp, known?.exitIp),
      alive: check.alive,
      latencyMs: latest(check.alive, check.latencyMs, known?.latencyMs),
      checksTotal: (known?.checksTotal ?? 0) + 1,
      checksAlive: (known?.checksAlive ?? 0) + (check.alive ? 1 : 0),
      lastCheckedAt: check.checkedAt,
      disabledAt: known?.disabledAt ?? null,
      credentials: known?.credentials ?? null,
    });
  }
}
