import type { ProxyEntity } from '../../domain/proxy/proxy.entity.js';
import type { BrowserSessionEntity } from '../../domain/session/browser-session.entity.js';
import type { BrowserSessionRepositoryPort } from '../session/browser-session-repository.port.js';
import type { PageInterface, PaginationInterface } from '../shared/page.interface.js';
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
  session: BrowserSessionEntity | null;
  ready: boolean;
}

export class ListProxiesUseCase {
  constructor(
    private readonly proxies: ProxyRepositoryPort,
    private readonly sessions: BrowserSessionRepositoryPort,
  ) {}

  async execute(
    filter: ProxyListFilterInterface,
    pagination: PaginationInterface,
  ): Promise<PageInterface<ProxyWithSessionInterface>> {
    const sessions = new Map(
      (await this.sessions.listByMarketplace(filter.marketplace)).flatMap(
        (session): Array<[string, BrowserSessionEntity]> =>
          session.snapshot.proxyServer === null ? [] : [[session.snapshot.proxyServer, session]],
      ),
    );
    const readyServers = Array.from(sessions.values())
      .filter((session): boolean => session.active)
      .flatMap((session): string[] =>
        session.snapshot.proxyServer === null ? [] : [session.snapshot.proxyServer],
      );

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
