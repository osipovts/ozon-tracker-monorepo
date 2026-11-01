import { type LoggerPort, silentLogger } from 'logger';

import type { ProxyCheckInterface } from '../domain/proxy-check.interface.js';
import type { ProxyProbePort } from './proxy-probe.port.js';
import type { ProxySourcePort } from './proxy-source.port.js';

export interface RefreshProxySourceParamsInterface {
  maxCandidates: number;
  probeTimeoutMs: number;
}

export interface RefreshProxySourceListenerInterface {
  /** Called once the candidates are known, before the first check. */
  onCandidates(count: number): Promise<void>;
  /** Called after every check, with how many are done and how many of them are alive. */
  onProgress(checked: number, alive: number): Promise<void>;
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
  ): Promise<void> {
    const fetched = await this.source.fetchCandidates(signal);
    const candidates = fetched.slice(0, params.maxCandidates);
    const total = candidates.length;
    this.logger.debug(
      `Source ${this.source.name} returned ${String(fetched.length)} candidates, checking ${String(total)}`,
    );
    await listener.onCandidates(total);

    let buffer: ProxyCheckInterface[] = [];
    let alive = 0;
    let checked = 0;
    const flush = async (): Promise<void> => {
      if (buffer.length === 0) return;

      const checks = buffer;
      buffer = [];
      await listener.onChecks(checks);
      this.logger.debug(
        `Source ${this.source.name}: ${String(checked)}/${String(total)} checked, ${String(alive)} alive`,
      );
    };

    // One worker failing stops the others: the job fails, and nothing of it may go on behind its back.
    const failed = new AbortController();
    const stop = AbortSignal.any([signal, failed.signal]);

    // The workers take the candidates one by one from the shared queue.
    const work = async (): Promise<void> => {
      for (let proxy = candidates.shift(); proxy !== undefined; proxy = candidates.shift()) {
        stop.throwIfAborted();
        const check = await this.probe.probe(proxy, params.probeTimeoutMs, stop);
        checked += 1;
        if (check.alive) alive += 1;
        buffer.push(check);
        // The buffer is handed over before anything is awaited, so that it never outgrows a batch.
        if (buffer.length >= this.batchSize) await flush();
        await listener.onProgress(checked, alive);
      }
    };
    const run = async (): Promise<void> => {
      try {
        await work();
      } catch (error: unknown) {
        failed.abort(error);
        throw error;
      }
    };

    await Promise.all(Array.from({ length: Math.min(this.concurrency, total) }, run));
    await flush();
  }
}
