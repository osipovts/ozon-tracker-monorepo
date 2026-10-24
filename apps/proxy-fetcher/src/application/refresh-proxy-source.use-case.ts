import { type LoggerPort, silentLogger } from 'logger';

import type { ProxyCheckInterface } from '../domain/proxy-check.interface.js';
import type { ProxyProbePort } from './proxy-probe.port.js';
import type { ProxySourcePort } from './proxy-source.port.js';

export interface RefreshProxySourceParamsInterface {
  maxCandidates: number;
  probeTimeoutMs: number;
}

export interface RefreshProxySourceSummaryInterface {
  candidates: number;
  alive: number;
}

export interface RefreshProxySourceListenerInterface {
  /** Called once the candidates are known, before the first check. */
  onCandidates(count: number): Promise<void>;
  /** Called with batches of finished checks. */
  onChecks(checks: ProxyCheckInterface[]): Promise<void>;
}

export class RefreshProxySourceUseCase {
  constructor(
    private readonly source: ProxySourcePort,
    private readonly probe: ProxyProbePort,
    private readonly concurrency: number,
    private readonly batchSize: number,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    params: RefreshProxySourceParamsInterface,
    signal: AbortSignal,
    listener: RefreshProxySourceListenerInterface,
  ): Promise<RefreshProxySourceSummaryInterface> {
    const fetched = await this.source.fetchCandidates(signal);
    const candidates = fetched.slice(0, params.maxCandidates);
    this.logger.debug(
      `Source ${this.source.name} returned ${String(fetched.length)} candidates, checking ${String(candidates.length)}`,
    );
    await listener.onCandidates(candidates.length);
    const pending = [...candidates];
    let buffer: ProxyCheckInterface[] = [];
    let alive = 0;
    let checked = 0;
    const flush = async (): Promise<void> => {
      if (buffer.length === 0) return;
      const checks = buffer;
      buffer = [];
      await listener.onChecks(checks);
      this.logger.debug(
        `Source ${this.source.name}: ${String(checked)}/${String(candidates.length)} checked, ${String(alive)} alive`,
      );
    };
    const run = async (): Promise<void> => {
      for (let proxy = pending.shift(); proxy !== undefined; proxy = pending.shift()) {
        signal.throwIfAborted();
        const check = await this.probe.probe(proxy, params.probeTimeoutMs, signal);
        checked += 1;
        if (check.alive) alive += 1;
        buffer.push(check);
        if (buffer.length >= this.batchSize) await flush();
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, candidates.length) }, run));
    await flush();
    return { candidates: candidates.length, alive };
  }
}
