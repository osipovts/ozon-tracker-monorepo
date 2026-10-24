import { type LoggerPort, silentLogger } from 'logger';
import { proxyFetchJobSchema, type ProxyFetchResultType } from 'queue-contract';

import type {
  RefreshProxySourceListenerInterface,
  RefreshProxySourceSummaryInterface,
} from '../application/refresh-proxy-source.use-case.js';
import type { RefreshProxySourceUseCase } from '../application/refresh-proxy-source.use-case.js';
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
    const sources = Array.from(new Set(job.sources));
    const startedAt = performance.now();
    this.logger.info(
      `Job ${job.jobId} started: ${sources.join(', ')}, up to ${String(job.maxCandidates)} candidates, probe timeout ${String(job.probeTimeoutMs)} ms`,
    );
    await this.publish({ type: 'job_started', jobId: job.jobId, sources });
    try {
      for (const [index, source] of sources.entries()) {
        signal.throwIfAborted();
        await this.refreshSource(
          job.jobId,
          source,
          { index, count: sources.length },
          job.maxCandidates,
          job.probeTimeoutMs,
          signal,
        );
      }
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
    const durationMs = Math.round(performance.now() - startedAt);
    this.logger.info(`Job ${job.jobId} done in ${String(durationMs)} ms`);
    await this.publish({ type: 'job_done', jobId: job.jobId, durationMs });
  }

  private async refreshSource(
    jobId: string,
    source: ProxySourceType,
    position: { index: number; count: number },
    maxCandidates: number,
    probeTimeoutMs: number,
    signal: AbortSignal,
  ): Promise<void> {
    let total = 0;
    let processed = 0;
    let succeeded = 0;
    // The sources share the job evenly: a finished source counts as a whole share.
    const reportProgress = (): Promise<void> =>
      this.publish({
        type: 'job_progress',
        jobId,
        percent: Math.floor(
          ((position.index + (total === 0 ? 1 : processed / total)) / position.count) * 100,
        ),
        processed,
        total,
        succeeded,
      });
    const listener: RefreshProxySourceListenerInterface = {
      onCandidates: async (candidates): Promise<void> => {
        total = candidates;
        await this.publish({ type: 'source_started', jobId, source, candidates });
        await reportProgress();
      },
      onChecks: async (checks): Promise<void> => {
        await this.publish({ type: 'proxy_checks', jobId, source, checks });
        processed += checks.length;
        succeeded += checks.filter((check): boolean => check.alive).length;
        await reportProgress();
      },
    };
    let summary: RefreshProxySourceSummaryInterface;
    try {
      summary = await this.useCases[source].execute(
        { maxCandidates, probeTimeoutMs },
        signal,
        listener,
      );
    } catch (error: unknown) {
      // A cancelled job is retried by the queue; a failed source is reported and skipped.
      signal.throwIfAborted();
      this.logger.error(
        `Source ${source} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await this.publish({
        type: 'source_done',
        jobId,
        source,
        status: 'failed',
        candidates: 0,
        alive: 0,
      });
      return;
    }
    this.logger.info(
      `Source ${source}: ${String(summary.alive)} of ${String(summary.candidates)} proxies alive`,
    );
    await this.publish({ type: 'source_done', jobId, source, status: 'ok', ...summary });
  }
}
