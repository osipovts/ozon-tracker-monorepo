import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { HubSessionsPort } from './hub-sessions.port.js';
import type { SessionCaptureInterface, SessionCapturePort } from './session-capture.port.js';

export type CaptureDecisionType = 'save' | 'skip';

export interface CaptureStepInterface {
  capture: SessionCaptureInterface;
  /** Null is the direct connection. */
  server: string | null;
  index: number;
  total: number;
}

export interface OnboardSummaryInterface {
  ready: Array<string | null>;
  skipped: Array<{ server: string | null; reason: string }>;
}

/** The address without credentials: they are not for the logs or the summary. */
function redacted(server: string): string {
  try {
    return new ProxyEndpointEntity(server).server;
  } catch {
    return server.replace(/\/\/[^@/]*@/, '//');
  }
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
    /** The routes to prepare instead of the proxies of the hub; null is the direct connection. */
    routes?: ReadonlyArray<string | null>,
  ): Promise<OnboardSummaryInterface> {
    const servers =
      routes ?? (await this.hub.listProxiesWithoutSession(this.capture.marketplace, limit));
    this.logger.info(`${String(servers.length)} routes need a session`);

    const summary: OnboardSummaryInterface = { ready: [], skipped: [] };
    for (const [index, server] of servers.entries()) {
      signal.throwIfAborted();
      const shown = server === null ? null : redacted(server);
      const reason = await this.prepare(server, shown, index, servers.length, decide);
      if (reason === null) summary.ready.push(shown);
      else summary.skipped.push({ server: shown, reason });
    }

    return summary;
  }

  /** Returns why the proxy was skipped, or null once it is ready. */
  private async prepare(
    server: string | null,
    shown: string | null,
    index: number,
    total: number,
    decide: (step: CaptureStepInterface) => Promise<CaptureDecisionType>,
  ): Promise<string | null> {
    const route = shown ?? 'direct connection';
    let proxy: ProxyEndpointEntity | null = null;
    try {
      if (server !== null) proxy = new ProxyEndpointEntity(server);
    } catch {
      return 'unsupported proxy address';
    }

    let capture: SessionCaptureInterface;
    try {
      this.logger.info(`[${String(index + 1)}/${String(total)}] Opening a window via ${route}`);
      capture = await this.capture.open(proxy);
    } catch (error: unknown) {
      const reason = `the route does not work: ${errorMessage(error)}`;
      this.logger.warn(`${route}: ${reason}`);

      return reason;
    }

    try {
      if ((await decide({ capture, server: shown, index, total })) === 'skip')
        return 'skipped by the person';

      const captured = await capture.export();
      await this.hub.uploadSession(captured);
      this.logger.info(
        `${route} is ready: session ${captured.session.id} uploaded, exit ${captured.session.exitIp}`,
      );

      return null;
    } catch (error: unknown) {
      const reason = errorMessage(error);
      this.logger.warn(`${route}: ${reason}`);

      return reason;
    } finally {
      await capture.close();
    }
  }
}
