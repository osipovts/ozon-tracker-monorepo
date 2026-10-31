import { errorMessage } from 'logger';
import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';
import { sessionExportFileSchema } from 'queue-contract';
import { z } from 'zod';

import type { HubSessionsPort } from '../../application/session/hub-sessions.port.js';
import type { CapturedSessionInterface } from '../../domain/session/captured-session.interface.js';

const proxyListSchema = z.object({ items: z.array(z.object({ server: z.string() })) });
const requestTimeoutMs = 30_000;

export class HubApiAdapter implements HubSessionsPort {
  constructor(
    private readonly baseUrl: string,
    /** The key of the operator of the hub: the routes of the proxies and the sessions are closed without it. */
    private readonly apiKey: string,
  ) {}

  async listProxiesWithoutSession(marketplace: MarketplaceType, limit: number): Promise<string[]> {
    const url = new URL('/proxies', this.baseUrl);
    url.search = new URLSearchParams({
      alive: 'true',
      // A proxy an administrator turned off is not to get a session either.
      disabled: 'false',
      country: marketplaceExitCountries[marketplace],
      ready: 'false',
      marketplace,
      pageSize: String(limit),
    }).toString();

    const response = await this.request(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
    if (!response.ok)
      throw new Error(`The hub answered HTTP ${String(response.status)} to the proxy list`);

    return proxyListSchema.parse(await response.json()).items.map((item): string => item.server);
  }

  async uploadSession(captured: CapturedSessionInterface): Promise<void> {
    const response = await this.request(new URL('/sessions', this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sessionExportFileSchema.parse(captured)),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (response.status !== 201)
      throw new Error(
        `The hub rejected the session: HTTP ${String(response.status)} ${(await response.text()).slice(0, 200)}`,
      );
  }

  /** Names the hub and the network error instead of the bare "fetch failed". */
  private async request(url: URL, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.apiKey}`);

    try {
      return await fetch(url, { ...init, headers });
    } catch (error: unknown) {
      const cause: unknown = error instanceof Error ? error.cause : undefined;
      const code =
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        typeof cause.code === 'string'
          ? cause.code
          : errorMessage(error);

      throw new Error(`Cannot reach the hub at ${this.baseUrl} (${code}); is it running?`, {
        cause: error,
      });
    }
  }
}
