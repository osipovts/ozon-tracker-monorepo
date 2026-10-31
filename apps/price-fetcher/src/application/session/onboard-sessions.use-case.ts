import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { HubSessionsPort } from './hub-sessions.port.js';
import type { SessionCaptureInterface, SessionCapturePort } from './session-capture.port.js';

export type CaptureDecisionType = 'save' | 'skip';

export interface CaptureStepInterface {
  capture: SessionCaptureInterface;
  server: string;
  index: number;
  total: number;
}

export interface OnboardSummaryInterface {
  ready: string[];
  skipped: Array<{ server: string; reason: string }>;
}

/** Prepares proxies of the hub one by one: a person passes the check, the session is uploaded. */
export class OnboardSessionsUseCase {
  constructor(
    private readonly hub: HubSessionsPort,
    private readonly capture: SessionCapturePort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(
    limit: number,
    signal: AbortSignal,
    decide: (step: CaptureStepInterface) => Promise<CaptureDecisionType>,
  ): Promise<OnboardSummaryInterface> {
    const servers = await this.hub.listProxiesWithoutSession(this.capture.marketplace, limit);
    this.logger.info(`${String(servers.length)} proxies need a session`);

    const summary: OnboardSummaryInterface = { ready: [], skipped: [] };
    for (const [index, server] of servers.entries()) {
      signal.throwIfAborted();
      const reason = await this.prepare(server, index, servers.length, decide);
      if (reason === null) summary.ready.push(server);
      else summary.skipped.push({ server, reason });
    }

    return summary;
  }

  /** Returns why the proxy was skipped, or null once it is ready. */
  private async prepare(
    server: string,
    index: number,
    total: number,
    decide: (step: CaptureStepInterface) => Promise<CaptureDecisionType>,
  ): Promise<string | null> {
    let proxy: ProxyEndpointEntity;
    try {
      proxy = new ProxyEndpointEntity(server);
    } catch {
      return 'unsupported proxy address';
    }

    let capture: SessionCaptureInterface;
    try {
      this.logger.info(`[${String(index + 1)}/${String(total)}] Opening a window via ${server}`);
      capture = await this.capture.open(proxy);
    } catch (error: unknown) {
      const reason = `the route does not work: ${errorMessage(error)}`;
      this.logger.warn(`${server}: ${reason}`);

      return reason;
    }

    try {
      if ((await decide({ capture, server, index, total })) === 'skip')
        return 'skipped by the person';

      const captured = await capture.export();
      await this.hub.uploadSession(captured);
      this.logger.info(
        `${server} is ready: session ${captured.session.id} uploaded, exit ${captured.session.exitIp}`,
      );

      return null;
    } catch (error: unknown) {
      const reason = errorMessage(error);
      this.logger.warn(`${server}: ${reason}`);

      return reason;
    } finally {
      await capture.close();
    }
  }
}
