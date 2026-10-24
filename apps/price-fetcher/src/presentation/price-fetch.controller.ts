import { type LoggerPort, silentLogger } from 'logger';
import type { ResolveProductReferenceUseCase } from 'product-reference';
import type { ProductReferenceEntity } from 'product-reference';
import { ProxyEndpointEntity } from 'proxy-endpoint';
import {
  priceFetchJobSchema,
  type PriceFetchJobType,
  type PriceFetchResultType,
  type SessionWarningType,
} from 'queue-contract';

import { GetProductSnapshotUseCase } from '../application/get-product-snapshot.use-case.js';
import type { ProductReaderPort } from '../application/product-reader.port.js';
import type { SessionStorePort } from '../application/session-store.port.js';
import {
  InMemorySessionStoreAdapter,
  type SessionRouteInterface,
} from '../infrastructure/in-memory-session-store.adapter.js';

export class InvalidPriceFetchJobError extends Error {}

export interface BrowserEnvironmentInterface {
  platform: string;
  browserVersion: string;
}

type ProductResultType = Extract<PriceFetchResultType, { type: 'product_result' }>;

const maxReasonLength = 200;

function majorVersion(version: string): string {
  return version.split('.')[0] ?? version;
}

export class PriceFetchController {
  constructor(
    private readonly resolveReference: ResolveProductReferenceUseCase,
    private readonly createReader: (
      sessions: SessionStorePort,
      timeoutMs: number,
    ) => ProductReaderPort,
    private readonly environment: BrowserEnvironmentInterface,
    private readonly publish: (message: PriceFetchResultType) => Promise<void>,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /**
   * Handles a raw queue message; throws InvalidPriceFetchJobError for a malformed one.
   * `willRetry` tells whether the queue is going to deliver the job again after a failure.
   */
  async handle(data: unknown, signal: AbortSignal, willRetry = false): Promise<void> {
    const parsed = priceFetchJobSchema.safeParse(data);
    if (!parsed.success) {
      this.logger.warn(
        `Dropping a malformed job: ${parsed.error.message.slice(0, maxReasonLength)}`,
      );
      throw new InvalidPriceFetchJobError('Malformed price fetch job');
    }
    const job = parsed.data;
    const startedAt = performance.now();
    this.logger.info(
      `Job ${job.jobId} started: ${String(job.products.length)} products, ${String(job.proxies.length)} routes (${String(job.proxies.filter((route): boolean => route.session !== undefined).length)} with a session), timeout ${String(job.timeoutMs)} ms`,
    );
    await this.publish({ type: 'job_started', jobId: job.jobId, products: job.products.length });
    try {
      await this.process(job, signal, startedAt);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Job ${job.jobId} failed (${willRetry ? 'will retry' : 'final'}): ${reason}`,
      );
      await this.publish({
        type: 'job_failed',
        jobId: job.jobId,
        reason: reason.slice(0, maxReasonLength),
        willRetry,
      }).catch((publishError: unknown): void => {
        this.logger.error(
          `Could not report the failure of job ${job.jobId}: ${publishError instanceof Error ? publishError.message : 'unknown error'}`,
        );
      });
      throw error;
    }
  }

  private async process(
    job: PriceFetchJobType,
    signal: AbortSignal,
    startedAt: number,
  ): Promise<void> {
    const candidates: Array<ProxyEndpointEntity | null> = [];
    const sessionRoutes: SessionRouteInterface[] = [];
    for (const route of job.proxies) {
      let proxy: ProxyEndpointEntity | null = null;
      try {
        if (route.server !== null) proxy = new ProxyEndpointEntity(route.server);
      } catch {
        // An unsafe or unsupported address is skipped like an unavailable proxy.
        this.logger.warn('Skipping a route with an unsafe or unsupported proxy address');
        continue;
      }
      candidates.push(proxy);
      if (route.session !== undefined) sessionRoutes.push({ proxy, session: route.session });
    }
    const sessions = new InMemorySessionStoreAdapter(sessionRoutes);
    const warnings = new Map<string, SessionWarningType[]>();
    for (const { session } of sessionRoutes) {
      const found: SessionWarningType[] = [];
      if (session.platform !== this.environment.platform) found.push('platform_mismatch');
      if (majorVersion(session.browserVersion) !== majorVersion(this.environment.browserVersion))
        found.push('browser_version_mismatch');
      warnings.set(session.id, found);
    }
    const useCase = new GetProductSnapshotUseCase(
      {
        getCandidates: (): Promise<Array<ProxyEndpointEntity | null>> =>
          Promise.resolve(candidates),
      },
      this.createReader(sessions, job.timeoutMs),
      this.logger.child('snapshot'),
    );

    let processed = 0;
    let succeeded = 0;
    const reportProgress = (): Promise<void> =>
      this.publish({
        type: 'job_progress',
        jobId: job.jobId,
        percent: Math.floor((processed / job.products.length) * 100),
        processed,
        total: job.products.length,
        succeeded,
      });
    await reportProgress();
    for (const product of job.products) {
      signal.throwIfAborted();
      let reference: ProductReferenceEntity;
      try {
        reference = this.resolveReference.execute(product.url);
      } catch {
        this.logger.warn(`Product ${product.trackedProductId}: unsupported URL`);
        await this.publish(this.invalidUrlResult(job.jobId, product.trackedProductId));
        processed += 1;
        await reportProgress();
        continue;
      }
      this.logger.info(
        `Product ${product.trackedProductId} (${reference.marketplace} ${reference.id}): reading`,
      );
      const result = await useCase.execute(reference, signal);
      this.logger.info(
        `Product ${product.trackedProductId}: ${result.status} after ${String(result.attempts.length)} attempts`,
      );
      const attempts = result.attempts.map((attempt): ProductResultType['attempts'][number] => {
        const sessionId = sessions.findByServer(attempt.proxy)?.id;
        return {
          proxy: attempt.proxy,
          ...(sessionId === undefined ? {} : { sessionId }),
          result: attempt.result,
        };
      });
      const attemptedWarnings = new Set<SessionWarningType>();
      for (const attempt of attempts) {
        for (const warning of warnings.get(attempt.sessionId ?? '') ?? [])
          attemptedWarnings.add(warning);
      }
      await this.publish({
        type: 'product_result',
        jobId: job.jobId,
        trackedProductId: product.trackedProductId,
        marketplace: reference.marketplace,
        externalId: reference.id,
        status: result.status,
        attempts,
        warnings: Array.from(attemptedWarnings),
      });
      processed += 1;
      if (result.status === 'success' || result.status === 'partial') succeeded += 1;
      await reportProgress();
    }

    const observedAt = new Date().toISOString();
    for (const update of sessions.drainUpdates()) {
      this.logger.info(`Session ${update.sessionId}: refreshed state is reported`);
      await this.publish({ type: 'session_update', jobId: job.jobId, observedAt, ...update });
    }
    for (const mismatch of sessions.drainMismatches()) {
      this.logger.warn(
        `Session ${mismatch.sessionId}: exit IP ${mismatch.actualIp} differs from ${mismatch.expectedIp}, the session was not used`,
      );
      await this.publish({ type: 'session_ip_mismatch', jobId: job.jobId, ...mismatch });
    }
    const durationMs = Math.round(performance.now() - startedAt);
    this.logger.info(`Job ${job.jobId} done in ${String(durationMs)} ms`);
    await this.publish({
      type: 'job_done',
      jobId: job.jobId,
      products: job.products.length,
      durationMs,
    });
  }

  private invalidUrlResult(jobId: string, trackedProductId: string): ProductResultType {
    return {
      type: 'product_result',
      jobId,
      trackedProductId,
      marketplace: null,
      externalId: null,
      status: 'invalid_url',
      attempts: [],
      warnings: [],
    };
  }
}
