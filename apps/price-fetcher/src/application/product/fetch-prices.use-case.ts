import { setTimeout } from 'node:timers/promises';

import { type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity, ResolveProductReferenceUseCase } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type {
  ProductAttemptInterface,
  TrackingResultInterface,
} from '../../domain/product/product-snapshot.interface.js';
import type { BrowserSessionInterface } from '../../domain/session/browser-session.interface.js';
import type {
  JobSessionStorePort,
  SessionMismatchInterface,
  SessionRouteInterface,
  SessionUpdateInterface,
} from '../session/job-session-store.port.js';
import type { SessionStorePort } from '../session/session-store.port.js';
import type { ProductReaderPort } from './product-reader.port.js';

export interface FetchPricesJobInterface {
  /** Routes in the order they are tried; a null server is a direct connection. */
  routes: ReadonlyArray<{ server: string | null; session: BrowserSessionInterface | null }>;
  products: ReadonlyArray<{ trackedProductId: string; url: string }>;
  timeoutMs: number;
}

export interface ProductFetchResultInterface {
  trackedProductId: string;
  status: TrackingResultInterface['status'] | 'invalid_url';
  attempts: Array<ProductAttemptInterface & { sessionId?: string }>;
}

export interface FetchPricesListenerInterface {
  onProgress(progress: { processed: number; total: number; succeeded: number }): Promise<void>;
  onProduct(result: ProductFetchResultInterface): Promise<void>;
  /** The state of a session was refreshed by the site during a read. */
  onSessionUpdate(update: SessionUpdateInterface): Promise<void>;
  /** The route exits through another address than the session was created with. */
  onSessionMismatch(mismatch: SessionMismatchInterface): Promise<void>;
}

/** Reads the prices of the products of a job through its routes and reports what happened. */
export class FetchPricesUseCase {
  constructor(
    private readonly resolveReference: ResolveProductReferenceUseCase,
    private readonly createSessions: (
      routes: readonly SessionRouteInterface[],
    ) => JobSessionStorePort,
    private readonly createReader: (
      sessions: SessionStorePort,
      timeoutMs: number,
    ) => ProductReaderPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    job: FetchPricesJobInterface,
    signal: AbortSignal,
    listener: FetchPricesListenerInterface,
  ): Promise<void> {
    const candidates: Array<ProxyEndpointEntity | null> = [];
    const sessionRoutes: SessionRouteInterface[] = [];
    for (const route of job.routes) {
      let proxy: ProxyEndpointEntity | null = null;
      try {
        if (route.server !== null) proxy = new ProxyEndpointEntity(route.server);
      } catch {
        // An unsafe or unsupported address is skipped like an unavailable proxy.
        this.logger.warn('Skipping a route with an unsafe or unsupported proxy address');
        continue;
      }

      candidates.push(proxy);
      if (route.session !== null) sessionRoutes.push({ proxy, session: route.session });
    }

    const sessions = this.createSessions(sessionRoutes);
    const reader = this.createReader(sessions, job.timeoutMs);
    const total = job.products.length;
    let processed = 0;
    let succeeded = 0;
    await listener.onProgress({ processed, total, succeeded });

    for (const product of job.products) {
      signal.throwIfAborted();
      const result = await this.fetchProduct(product, candidates, reader, sessions, signal);
      await listener.onProduct(result);

      processed += 1;
      if (result.status === 'success' || result.status === 'partial') succeeded += 1;
      await listener.onProgress({ processed, total, succeeded });
    }

    for (const update of sessions.drainUpdates()) {
      this.logger.info(`Session ${update.sessionId}: refreshed state is reported`);
      await listener.onSessionUpdate(update);
    }

    for (const mismatch of sessions.drainMismatches()) {
      this.logger.warn(
        `Session ${mismatch.sessionId}: exit IP ${mismatch.actualIp} differs from ${mismatch.expectedIp}, the session was not used`,
      );
      await listener.onSessionMismatch(mismatch);
    }
  }

  private async fetchProduct(
    product: { trackedProductId: string; url: string },
    candidates: ReadonlyArray<ProxyEndpointEntity | null>,
    reader: ProductReaderPort,
    sessions: JobSessionStorePort,
    signal: AbortSignal,
  ): Promise<ProductFetchResultInterface> {
    let reference: ProductReferenceEntity;
    try {
      reference = this.resolveReference.execute(product.url);
    } catch {
      this.logger.warn(`Product ${product.trackedProductId}: unsupported URL`);

      return { trackedProductId: product.trackedProductId, status: 'invalid_url', attempts: [] };
    }

    this.logger.info(
      `Product ${product.trackedProductId} (${reference.marketplace} ${reference.id}): reading`,
    );
    const result = await this.readProduct(reference, candidates, reader, signal);
    this.logger.info(
      `Product ${product.trackedProductId}: ${result.status} after ${String(result.attempts.length)} attempts`,
    );

    return {
      trackedProductId: product.trackedProductId,
      status: result.status,
      attempts: result.attempts.map((attempt): ProductFetchResultInterface['attempts'][number] => {
        const sessionId = sessions.findByServer(attempt.proxy)?.id;

        return sessionId === undefined ? attempt : { ...attempt, sessionId };
      }),
    };
  }

  /** Tries the routes in order until the site gives an answer that another route cannot change. */
  private async readProduct(
    reference: ProductReferenceEntity,
    candidates: ReadonlyArray<ProxyEndpointEntity | null>,
    reader: ProductReaderPort,
    signal: AbortSignal,
  ): Promise<TrackingResultInterface> {
    const output: TrackingResultInterface = { status: 'no_proxies', attempts: [] };
    this.logger.debug(`${String(candidates.length)} routes to try`);

    for (const proxy of candidates) {
      signal.throwIfAborted();
      if (output.attempts.length > 0) await setTimeout(1000, undefined, { signal });

      const route = `Attempt ${String(output.attempts.length + 1)} via ${proxy?.server ?? 'direct connection'}`;
      this.logger.verbose(route);
      const startedAt = performance.now();
      const result = await reader.read(reference, proxy, signal);
      this.logger.verbose(
        `${route}: ${result.status} in ${String(Math.round(performance.now() - startedAt))} ms`,
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
