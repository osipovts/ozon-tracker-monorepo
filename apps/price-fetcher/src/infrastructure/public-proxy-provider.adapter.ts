import { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxyProviderPort } from '../application/proxy-provider.port.js';

export class PublicProxyProviderAdapter implements ProxyProviderPort {
  constructor(private readonly limit: number) {}

  async getCandidates(signal: AbortSignal): Promise<ProxyEndpointEntity[]> {
    const response = await fetch(
      'https://raw.githubusercontent.com/maximilianfeix/free-proxy-list/main/countries/ru.txt',
      {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        redirect: 'error',
      },
    );
    if (!response.ok) throw new Error(`Proxy list returned HTTP ${String(response.status)}`);
    const candidates: ProxyEndpointEntity[] = [];
    for (const line of new Set(
      (await response.text()).split(/\r?\n/).map((value): string => value.trim()),
    )) {
      try {
        candidates.push(new ProxyEndpointEntity(line));
      } catch {
        continue;
      }
      if (candidates.length === this.limit) break;
    }
    return candidates;
  }
}
