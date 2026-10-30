import type {
  ListMarketplaceSessionsUseCase,
  MarketplaceSessionInterface,
} from '../../browser-session/application/index.js';
import type {
  PageInterface,
  PaginationInterface,
} from '../../shared/application/page.interface.js';
import type { ProxyEntity } from '../domain/proxy.entity.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';

export interface ProxyListFilterInterface {
  alive?: boolean;
  country?: string;
  /** The marketplace whose sessions make a proxy ready. */
  marketplace: string;
  /** Ready proxies have an active session of the marketplace. */
  ready?: boolean;
}

export interface ProxyWithSessionInterface {
  proxy: ProxyEntity;
  /** The session of the marketplace bound to the proxy, whatever its status. */
  session: MarketplaceSessionInterface | null;
  ready: boolean;
}

export class ListProxiesUseCase {
  constructor(
    private readonly proxies: ProxyRepositoryPort,
    private readonly sessions: ListMarketplaceSessionsUseCase,
  ) {}

  async execute(
    filter: ProxyListFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyWithSessionInterface>> {
    const sessions = new Map(
      (await this.sessions.execute(filter.marketplace)).flatMap(
        (session): Array<[string, MarketplaceSessionInterface]> =>
          session.proxyServer === null ? [] : [[session.proxyServer, session]],
      ),
    );
    const readyServers = Array.from(sessions.entries())
      .filter(([, session]): boolean => session.active)
      .map(([server]): string => server);

    const page = await this.proxies.list(
      {
        ...(filter.alive === undefined ? {} : { alive: filter.alive }),
        ...(filter.country === undefined ? {} : { country: filter.country }),
        ...(filter.ready === undefined
          ? {}
          : filter.ready
            ? { servers: readyServers }
            : { excludedServers: readyServers }),
      },
      pagination,
    );

    return {
      items: page.items.map((proxy): ProxyWithSessionInterface => {
        const session = sessions.get(proxy.snapshot.server) ?? null;

        return { proxy, session, ready: session?.active ?? false };
      }),
      total: page.total,
    };
  }
}
