import type { ProxyCheckInterface } from './proxy-check.interface.js';

export class ProxyEntity {
  constructor(
    readonly server: string,
    readonly source: string,
    readonly country: string | null,
    readonly exitIp: string | null,
    readonly alive: boolean,
    /** Latency of the last successful check. */
    readonly latencyMs: number | null,
    readonly checksTotal: number,
    readonly checksAlive: number,
    readonly lastCheckedAt: Date,
  ) {}

  get successRate(): number {
    return this.checksTotal === 0 ? 0 : this.checksAlive / this.checksTotal;
  }

  static fromCheck(check: ProxyCheckInterface, previous?: ProxyEntity): ProxyEntity {
    return new ProxyEntity(
      check.server,
      check.source,
      check.alive ? check.country : (previous?.country ?? null),
      check.alive ? check.exitIp : (previous?.exitIp ?? null),
      check.alive,
      check.alive ? check.latencyMs : (previous?.latencyMs ?? null),
      (previous?.checksTotal ?? 0) + 1,
      (previous?.checksAlive ?? 0) + (check.alive ? 1 : 0),
      check.checkedAt,
    );
  }
}
