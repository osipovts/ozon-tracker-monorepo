import { type LoggerPort, silentLogger } from 'logger';
import {
  proxyFetchJobSchema,
  type ProxyFetchJobType,
  type ProxyFetchResultType,
} from 'queue-contract';
import type { JobLifecycleReporter, QueueMessageParser } from 'queue-worker';

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

export class ProxyFetchController {
  constructor(
    private readonly useCases: SourceUseCasesType,
    private readonly messages: QueueMessageParser,
    private readonly lifecycle: JobLifecycleReporter,
    private readonly publish: (message: ProxyFetchResultType) => Promise<void>,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** `willRetry` tells whether the queue is going to deliver the job again after a failure. */
  async handle(data: unknown, signal: AbortSignal, willRetry = false): Promise<void> {
    const job = this.messages.parse(proxyFetchJobSchema, data, 'proxy fetch job');
    this.logger.info(
      `Job ${job.jobId} started: ${job.source}, up to ${String(job.maxCandidates)} candidates, probe timeout ${String(job.probeTimeoutMs)} ms`,
    );

    await this.lifecycle.run(job.jobId, willRetry, (): Promise<void> => this.refresh(job, signal));
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
