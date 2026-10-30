import type { ProxyCheckInterface } from './proxy-check.interface.js';

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

  static fromCheck(check: ProxyCheckInterface, previous?: ProxyEntity): ProxyEntity {
    const known = previous?.snapshot;

    return new ProxyEntity({
      server: check.server,
      source: check.source,
      country: latest(check.alive, check.country, known?.country),
      exitIp: latest(check.alive, check.exitIp, known?.exitIp),
      alive: check.alive,
      latencyMs: latest(check.alive, check.latencyMs, known?.latencyMs),
      checksTotal: (known?.checksTotal ?? 0) + 1,
      checksAlive: (known?.checksAlive ?? 0) + (check.alive ? 1 : 0),
      lastCheckedAt: check.checkedAt,
    });
  }
}
