import { type LoggerPort, silentLogger } from 'logger';
import {
  proxyFetchJobSchema,
  type ProxyFetchJobType,
  type ProxyFetchResultType,
} from 'queue-contract';

import type {
  RefreshProxySourceListenerInterface,
  RefreshProxySourceUseCase,
} from '../application/refresh-proxy-source.use-case.js';
import type { ProxySourceType } from '../domain/proxy-source.type.js';

/** Indexed by the contract source, so a source unknown to the domain fails to compile. */
type SourceUseCasesType = Record<
  ProxySourceType,
  { execute: RefreshProxySourceUseCase['execute'] }
>;

export class InvalidProxyFetchJobError extends Error {}

const maxReasonLength = 200;

export class ProxyFetchController {
  constructor(
    private readonly useCases: SourceUseCasesType,
    private readonly publish: (message: ProxyFetchResultType) => Promise<void>,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /**
   * Handles a raw queue message; throws InvalidProxyFetchJobError for a malformed one.
   * `willRetry` tells whether the queue is going to deliver the job again after a failure.
   */
  async handle(data: unknown, signal: AbortSignal, willRetry = false): Promise<void> {
    const parsed = proxyFetchJobSchema.safeParse(data);
    if (!parsed.success) {
      this.logger.warn(
        `Dropping a malformed job: ${parsed.error.message.slice(0, maxReasonLength)}`,
      );
      throw new InvalidProxyFetchJobError('Malformed proxy fetch job');
    }

    const job = parsed.data;
    const startedAt = performance.now();
    this.logger.info(
      `Job ${job.jobId} started: ${job.source}, up to ${String(job.maxCandidates)} candidates, probe timeout ${String(job.probeTimeoutMs)} ms`,
    );
    await this.publish({ type: 'job_started', jobId: job.jobId });

    try {
      await this.refresh(job, signal);
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

    this.logger.info(
      `Job ${job.jobId} done in ${String(Math.round(performance.now() - startedAt))} ms`,
    );
    await this.publish({ type: 'job_done', jobId: job.jobId });
  }

  private async refresh(job: ProxyFetchJobType, signal: AbortSignal): Promise<void> {
    let total = 0;
    let processed = 0;
    let succeeded = 0;
    const reportProgress = (): Promise<void> =>
      this.publish({ type: 'job_progress', jobId: job.jobId, processed, total, succeeded });
    const listener: RefreshProxySourceListenerInterface = {
      onCandidates: async (candidates): Promise<void> => {
        total = candidates;
        await reportProgress();
      },
      onChecks: async (checks): Promise<void> => {
        await this.publish({ type: 'proxy_checks', jobId: job.jobId, source: job.source, checks });
        processed += checks.length;
        succeeded += checks.filter((check): boolean => check.alive).length;
        await reportProgress();
      },
    };

    await this.useCases[job.source].execute(
      { maxCandidates: job.maxCandidates, probeTimeoutMs: job.probeTimeoutMs },
      signal,
      listener,
    );
    this.logger.info(
      `Source ${job.source}: ${String(succeeded)} of ${String(total)} proxies alive`,
    );
  }
}
