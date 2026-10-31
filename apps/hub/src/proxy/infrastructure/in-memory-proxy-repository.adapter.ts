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

function matches({ snapshot }: ProxyEntity, filter: ProxyFilterInterface): boolean {
  return (
    (filter.alive === undefined || snapshot.alive === filter.alive) &&
    (filter.country === undefined || snapshot.country === filter.country) &&
    (filter.disabled === undefined || (snapshot.disabledAt !== null) === filter.disabled) &&
    (filter.servers === undefined || filter.servers.includes(snapshot.server)) &&
    filter.excludedServers?.includes(snapshot.server) !== true
  );
}

/** The best first: alive ones, then the most reliable, then the fastest. */
function byQuality(a: ProxyEntity, b: ProxyEntity): number {
  return (
    Number(b.snapshot.alive) - Number(a.snapshot.alive) ||
    b.successRate - a.successRate ||
    (a.snapshot.latencyMs ?? Infinity) - (b.snapshot.latencyMs ?? Infinity)
  );
}

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

  delete(server: string): Promise<boolean> {
    return Promise.resolve(this.proxies.delete(server));
  }

  list(
    filter: ProxyFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyEntity>> {
    const matching = Array.from(this.proxies.values())
      .filter((proxy): boolean => matches(proxy, filter))
      .toSorted(byQuality);

    return Promise.resolve(pageOf(matching, pagination));
  }
}
