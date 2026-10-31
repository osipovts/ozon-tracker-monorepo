import type { ProxyRepositoryPort } from './proxy-repository.port.js';

export interface BestProxyServersQueryInterface {
  /** ISO 3166-1 alpha-2 code of the exit country. */
  country: string;
  limit: number;
}

/** The alive proxies of an exit country, the best first, for the contexts that route through them. */
export class ListBestProxyServersUseCase {
  constructor(private readonly proxies: ProxyRepositoryPort) {}

  async execute(query: BestProxyServersQueryInterface): Promise<string[]> {
    const best = await this.proxies.list(
      { alive: true, country: query.country, disabled: false },
      { page: 1, pageSize: query.limit },
    );

    return best.items.map((proxy): string => proxy.snapshot.server);
  }
}
