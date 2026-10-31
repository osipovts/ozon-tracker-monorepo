import type { ProxyRepositoryPort, ProxyStatsInterface } from './proxy-repository.port.js';

export type { ProxyStatsInterface } from './proxy-repository.port.js';

export class GetProxyStatsUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  execute(): Promise<ProxyStatsInterface> {
    return this.proxies.stats();
  }
}
