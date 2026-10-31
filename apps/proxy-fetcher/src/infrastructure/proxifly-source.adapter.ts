import { type LoggerPort, silentLogger } from 'logger';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProxySourcePort } from '../application/proxy-source.port.js';
import type { ProxySourceType } from '../domain/proxy-source.type.js';
import { ProxyListParser } from './proxy-list.parser.js';

export class ProxiflySourceAdapter implements ProxySourcePort {
  readonly name: ProxySourceType = 'proxifly';

  constructor(
    private readonly parser: ProxyListParser = new ProxyListParser(),
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async fetchCandidates(signal: AbortSignal): Promise<ProxyEndpointEntity[]> {
    this.logger.debug('Downloading the proxy list');
    const response = await fetch(
      'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/countries/RU/data.txt',
      {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
        redirect: 'error',
      },
    );
    if (!response.ok) throw new Error(`Proxy list returned HTTP ${String(response.status)}`);

    const candidates = this.parser.parse(await response.text());
    this.logger.debug(`Proxy list: ${String(candidates.length)} usable`);

    return candidates;
  }
}
