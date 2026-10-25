import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
} from '../../application/proxy/proxy-repository.port.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../application/shared/page.interface.js';
import type { ProxyEntity } from '../../domain/proxy/proxy.entity.js';

export class InMemoryProxyRepositoryAdapter implements ProxyRepositoryPort {
  private readonly proxies = new Map<string, ProxyEntity>();

  findByServers(servers: string[]): Promise<ProxyEntity[]> {
    return Promise.resolve(
      servers.flatMap((server): ProxyEntity[] => {
        const proxy = this.proxies.get(server);

        return proxy === undefined ? [] : [proxy];
      }),
    );
  }

  saveMany(proxies: ProxyEntity[]): Promise<void> {
    for (const proxy of proxies) this.proxies.set(proxy.server, proxy);

    return Promise.resolve();
  }

  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    const matching = Array.from(this.proxies.values())
      .filter(
        (proxy): boolean =>
          (filter.alive === undefined || proxy.alive === filter.alive) &&
          (filter.country === undefined || proxy.country === filter.country) &&
          (filter.servers === undefined || filter.servers.includes(proxy.server)) &&
          filter.excludedServers?.includes(proxy.server) !== true,
      )
      .toSorted(
        (a, b): number =>
          Number(b.alive) - Number(a.alive) ||
          b.successRate - a.successRate ||
          (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity),
      );
    const start = (pagination.page - 1) * pagination.pageSize;

    return Promise.resolve({
      items: matching.slice(start, start + pagination.pageSize),
      total: matching.length,
    });
  }
}
