import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
} from '../application/proxy-repository.port.js';
import type { ProxyEntity } from '../domain/proxy.entity.js';

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
    for (const proxy of proxies) this.proxies.set(proxy.snapshot.server, proxy);

    return Promise.resolve();
  }

  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    const matching = Array.from(this.proxies.values())
      .filter(
        ({ snapshot }): boolean =>
          (filter.alive === undefined || snapshot.alive === filter.alive) &&
          (filter.country === undefined || snapshot.country === filter.country) &&
          (filter.servers === undefined || filter.servers.includes(snapshot.server)) &&
          filter.excludedServers?.includes(snapshot.server) !== true,
      )
      .toSorted(
        (a, b): number =>
          Number(b.snapshot.alive) - Number(a.snapshot.alive) ||
          b.successRate - a.successRate ||
          (a.snapshot.latencyMs ?? Infinity) - (b.snapshot.latencyMs ?? Infinity),
      );

    return Promise.resolve(pageOf(matching, pagination));
  }
}
