import { setTimeout } from 'node:timers/promises';

import { type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { TrackingResultInterface } from '../domain/product-snapshot.interface.js';
import type { ProductReaderPort } from './product-reader.port.js';
import type { ProxyProviderPort } from './proxy-provider.port.js';

export class GetProductSnapshotUseCase {
  constructor(
    private readonly proxies: ProxyProviderPort,
    private readonly reader: ProductReaderPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    reference: ProductReferenceEntity,
    signal: AbortSignal,
    override?: ProxyEndpointEntity | null,
  ): Promise<TrackingResultInterface> {
    const candidates =
      override === undefined ? await this.proxies.getCandidates(signal) : [override];
    const output: TrackingResultInterface = {
      marketplace: reference.marketplace,
      productId: reference.id,
      url: reference.url,
      status: 'no_proxies',
      attempts: [],
    };
    this.logger.debug(`${String(candidates.length)} routes to try`);
    for (const proxy of candidates) {
      signal.throwIfAborted();
      if (output.attempts.length > 0) await setTimeout(1000, undefined, { signal });
      this.logger.verbose(
        `Attempt ${String(output.attempts.length + 1)} via ${proxy?.server ?? 'direct connection'}`,
      );
      const startedAt = performance.now();
      const result = await this.reader.read(reference, proxy, signal);
      this.logger.verbose(
        `Attempt ${String(output.attempts.length + 1)} via ${proxy?.server ?? 'direct connection'}: ${result.status} in ${String(Math.round(performance.now() - startedAt))} ms`,
      );
      output.attempts.push({ proxy: proxy?.server ?? null, result });
      output.status = result.status;
      // A challenge is a site decision, not a dead proxy: do not rotate to evade it.
      if (
        ['success', 'partial', 'challenge_required', 'parse_error', 'http_error'].includes(
          result.status,
        )
      )
        break;
    }
    return output;
  }
}
