import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';

import type { RouteInterface } from '../../job/application/index.js';
import type { ListBestProxyServersUseCase } from '../../proxy/application/index.js';

/** The ways a job may reach a marketplace, in the order of trying: the direct connection is the one after the first. */
export class ChoosePriceRoutesUseCase {
  constructor(
    private readonly proxyServers: ListBestProxyServersUseCase,
    /** How many of the best proxies a job may try. */
    private readonly proxyCount: number,
  ) {}

  /** None is an empty list. */
  async execute(marketplace: MarketplaceType): Promise<RouteInterface[]> {
    // The workers accept exits in the country of the marketplace only: others would be rejected anyway.
    const best = await this.proxyServers.execute({
      country: marketplaceExitCountries[marketplace],
      limit: this.proxyCount,
    });

    // The workers connect with the credentials of a proxy, which the hub keeps apart from its server.
    const urls = await this.proxyServers.urlsOf(best);
    const routes = best.map((server): RouteInterface => ({ server: urls.get(server) ?? server }));

    // The direct connection is the second chance, so there must be a first one.
    if (routes.length > 0) routes.splice(1, 0, { server: null });

    return routes;
  }
}
