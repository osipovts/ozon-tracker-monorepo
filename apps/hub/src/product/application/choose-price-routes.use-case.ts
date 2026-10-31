import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';

import type { ListMarketplaceSessionsUseCase } from '../../browser-session/application/index.js';
import type { RouteInterface } from '../../job/application/index.js';
import type { ListBestProxyServersUseCase } from '../../proxy/application/index.js';

/** The ways a job may reach a marketplace, in the order of trying: the direct connection is the one after the first. */
export class ChoosePriceRoutesUseCase {
  constructor(
    private readonly proxyServers: ListBestProxyServersUseCase,
    private readonly sessions: ListMarketplaceSessionsUseCase,
    /** How many of the best proxies a job may try after the routes with a session. */
    private readonly proxyCount: number,
  ) {}

  /** Routes with a session come first: they are the ones the site lets through. None is an empty list. */
  async execute(marketplace: MarketplaceType): Promise<RouteInterface[]> {
    const sessions = await this.sessions.execute(marketplace);
    const routes: RouteInterface[] = sessions
      .filter((session): boolean => session.active)
      .map((session): RouteInterface => ({
        server: session.proxyServer,
        session: {
          id: session.id,
          exitIp: session.exitIp,
          userAgent: session.userAgent,
          storageState: session.storageState,
        },
      }));

    const taken = new Set(routes.map((route): string | null => route.server));
    // The workers accept exits in the country of the marketplace only: others would be rejected anyway.
    const best = await this.proxyServers.execute({
      country: marketplaceExitCountries[marketplace],
      limit: this.proxyCount,
    });

    for (const server of best) {
      if (!taken.has(server)) routes.push({ server, session: null });
    }

    // The workers connect with the credentials of a proxy, which the hub keeps apart from its server.
    const urls = await this.proxyServers.urlsOf(
      routes.flatMap((route): string[] => (route.server === null ? [] : [route.server])),
    );
    const authenticated = routes.map((route): RouteInterface =>
      route.server === null ? route : { ...route, server: urls.get(route.server) ?? route.server },
    );

    // The direct connection is the second chance, so there must be a first one; a session of it is already among the routes.
    if (
      authenticated.length > 0 &&
      !authenticated.some((route): boolean => route.server === null)
    ) {
      authenticated.splice(1, 0, { server: null, session: null });
    }

    return authenticated;
  }
}
