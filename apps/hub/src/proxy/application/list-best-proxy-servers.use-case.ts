import type { ProxyRepositoryPort } from './proxy-repository.port.js';

export interface BestProxyServersQueryInterface {
  /** ISO 3166-1 alpha-2 code of the exit country. */
  country: string;
  limit: number;
}

/**
 * The proxies for the contexts that route through them: the ones added by hand first, whatever their check
 * and country, then the alive proxies of an exit country, the best first.
 */
export class ListBestProxyServersUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  async execute(query: BestProxyServersQueryInterface): Promise<string[]> {
    const manual = await this.proxies.list(
      { manual: true, disabled: false },
      { page: 1, pageSize: query.limit },
    );
    const found = await this.proxies.list(
      { manual: false, alive: true, country: query.country, disabled: false },
      { page: 1, pageSize: Math.max(query.limit - manual.items.length, 1) },
    );

    return [...manual.items, ...found.items.slice(0, query.limit - manual.items.length)].map(
      (proxy): string => proxy.snapshot.server,
    );
  }

  /** The addresses the workers connect to: the servers with their credentials, if they have them. */
  async urlsOf(servers: readonly string[]): Promise<Map<string, string>> {
    const known = await this.proxies.findByServers([...servers]);

    return new Map(known.map((proxy): [string, string] => [proxy.snapshot.server, proxy.routeUrl]));
  }
}
