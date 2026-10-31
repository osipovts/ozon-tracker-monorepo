import {
  type PageInterface,
  pageOf,
  type PaginationInterface,
} from '../../shared/application/page.interface.js';
import type {
  ProxyFilterInterface,
  ProxyRepositoryPort,
  ProxyStatsInterface,
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

/** The best first: alive ones, then the most reliable, then the fastest, then by address. */
function byQuality(a: ProxyEntity, b: ProxyEntity): number {
  return (
    Number(b.snapshot.alive) - Number(a.snapshot.alive) ||
    b.successRate - a.successRate ||
    (a.snapshot.latencyMs ?? Infinity) - (b.snapshot.latencyMs ?? Infinity) ||
    a.snapshot.server.localeCompare(b.snapshot.server)
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

  stats(): Promise<ProxyStatsInterface> {
    const all = Array.from(this.proxies.values()).map(({ snapshot }) => snapshot);
    const latencies = all
      .filter((proxy): boolean => proxy.alive && proxy.latencyMs !== null)
      .map((proxy): number => proxy.latencyMs ?? 0);

    return Promise.resolve({
      total: all.length,
      alive: all.filter((proxy): boolean => proxy.alive).length,
      disabled: all.filter((proxy): boolean => proxy.disabledAt !== null).length,
      averageLatencyMs:
        latencies.length === 0
          ? null
          : Math.round(latencies.reduce((sum, value): number => sum + value, 0) / latencies.length),
      lastCheckedAt:
        all.length === 0
          ? null
          : new Date(Math.max(...all.map((proxy): number => proxy.lastCheckedAt.getTime()))),
    });
  }

  delete(server: string): Promise<boolean> {
    return Promise.resolve(this.proxies.delete(server));
  }

  deleteAll(): Promise<number> {
    const { size } = this.proxies;
    this.proxies.clear();

    return Promise.resolve(size);
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
