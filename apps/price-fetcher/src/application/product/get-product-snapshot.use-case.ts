import { setTimeout } from 'node:timers/promises';

import { type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { TrackingResultInterface } from '../../domain/product/product-snapshot.interface.js';
import type { ProductReaderPort } from './product-reader.port.js';

export class GetProductSnapshotUseCase {
  constructor(
    private readonly reader: ProductReaderPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** Tries the routes in order; a null route is a direct connection. */
  async execute(
    reference: ProductReferenceEntity,
    candidates: ReadonlyArray<ProxyEndpointEntity | null>,
    signal: AbortSignal,
  ): Promise<TrackingResultInterface> {
    const output: TrackingResultInterface = { status: 'no_proxies', attempts: [] };
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
