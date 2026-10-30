import { type LoggerPort, silentLogger } from 'logger';
import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';

import type { ListMarketplaceSessionsUseCase } from '../../browser-session/application/index.js';
import type { RouteInterface, ScheduleJobUseCase } from '../../job/application/index.js';
import type { ListBestProxyServersUseCase } from '../../proxy/application/index.js';
import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

export interface RequestPriceObservationSettingsInterface {
  /** How many of the best proxies a job may try after the routes with a session. */
  proxyCount: number;
  timeoutMs: number;
}

/** Queues a read of the fresh price of a tracked product; it ends up in the price history. */
export class RequestPriceObservationUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly proxyServers: ListBestProxyServersUseCase,
    private readonly sessions: ListMarketplaceSessionsUseCase,
    private readonly scheduleJob: ScheduleJobUseCase,
    private readonly settings: RequestPriceObservationSettingsInterface,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(userId: string, productId: string): Promise<{ jobId: string }> {
    const found = await this.products.findSubscribed(userId, productId);
    if (found === null) throw new ProductNotFoundError(productId);

    const product = found.snapshot;

    const routes = await this.chooseRoutes(product.marketplace);
    if (routes.length === 0) throw new NoProxiesAvailableError();

    const { jobId } = await this.scheduleJob.execute({
      kind: 'price_fetch',
      requestedBy: userId,
      productId: product.id,
      routes,
      products: [{ trackedProductId: product.id, url: product.url }],
      timeoutMs: this.settings.timeoutMs,
    });

    this.logger.info(
      `Queued price observation ${jobId} of ${product.marketplace} ${product.externalId} (product ${product.id}) via ${String(routes.length)} routes: ${routes
        .map(
          (route): string =>
            `${route.server ?? 'direct'}${route.session === null ? '' : ' [session]'}`,
        )
        .join(', ')}`,
    );

    return { jobId };
  }

  /** Routes with a session come first: they are the ones the site lets through. */
  private async chooseRoutes(marketplace: MarketplaceType): Promise<RouteInterface[]> {
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
      limit: this.settings.proxyCount,
    });

    for (const server of best) {
      if (!taken.has(server)) routes.push({ server, session: null });
    }

    return routes;
  }
}
