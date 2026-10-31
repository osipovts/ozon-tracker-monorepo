import { type LoggerPort, silentLogger } from 'logger';
import { linkExpandJobSchema, type LinkExpandResultType } from 'queue-contract';
import type { QueueMessageParser } from 'queue-worker';

import type { ExpandLinkUseCase } from '../../application/link/expand-link.use-case.js';

export class LinkExpandController {
  constructor(
    private readonly expandLink: Pick<ExpandLinkUseCase, 'execute'>,
    private readonly messages: QueueMessageParser,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** The returned address is the result of the job. */
  async handle(data: unknown, signal: AbortSignal): Promise<LinkExpandResultType> {
    const job = this.messages.parse(linkExpandJobSchema, data, 'link expand job');
    this.logger.info(`Expanding a short link via ${String(job.proxies.length)} routes`);

    const url = await this.expandLink.execute(
      {
        url: job.url,
        routes: job.proxies.map((route) => ({
          server: route.server,
          session: route.session ?? null,
        })),
        timeoutMs: job.timeoutMs,
      },
      signal,
    );

    return { url };
  }
}
