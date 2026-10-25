import { randomUUID } from 'node:crypto';

import { type LoggerPort, silentLogger } from 'logger';
import { marketplaceExitCountries, type MarketplaceType } from 'product-reference';

import { JobEntity } from '../../domain/job/job.entity.js';
import type { JobQueuePort, RouteInterface } from '../job/job-queue.port.js';
import type { JobRepositoryPort } from '../job/job-repository.port.js';
import { NoProxiesAvailableError } from '../proxy/no-proxies-available.error.js';
import type { ProxyRepositoryPort } from '../proxy/proxy-repository.port.js';
import type { BrowserSessionRepositoryPort } from '../session/browser-session-repository.port.js';
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
    private readonly proxies: ProxyRepositoryPort,
    private readonly sessions: BrowserSessionRepositoryPort,
    private readonly queue: JobQueuePort,
    private readonly jobs: JobRepositoryPort,
    private readonly settings: RequestPriceObservationSettingsInterface,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(productId: string): Promise<{ jobId: string }> {
    const found = await this.products.findById(productId);
    if (found === null) throw new ProductNotFoundError(productId);

    const product = found.snapshot;

    const routes = await this.chooseRoutes(product.marketplace);
    if (routes.length === 0) throw new NoProxiesAvailableError();

    const jobId = randomUUID();
    const job = JobEntity.queued(jobId, 'price_fetch', product.id, 1, new Date());
    await this.jobs.save(job);

    try {
      await this.queue.enqueuePriceFetch({
        jobId,
        routes,
        products: [{ trackedProductId: product.id, url: product.url }],
        timeoutMs: this.settings.timeoutMs,
      });
    } catch (error: unknown) {
      await this.jobs.save(job.failed('Could not be queued', false, new Date()));
      throw error;
    }

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
    const sessions = await this.sessions.listByMarketplace(marketplace);
    const routes: RouteInterface[] = sessions
      .filter((session): boolean => session.active)
      .map((session): RouteInterface => ({
        server: session.snapshot.proxyServer,
        session: {
          id: session.snapshot.id,
          exitIp: session.snapshot.exitIp,
          userAgent: session.snapshot.userAgent,
          storageState: session.snapshot.storageState,
        },
      }));

    const taken = new Set(routes.map((route): string | null => route.server));
    // The workers accept exits in the country of the marketplace only: others would be rejected anyway.
    const best = await this.proxies.list(
      { alive: true, country: marketplaceExitCountries[marketplace] },
      { page: 1, pageSize: this.settings.proxyCount },
    );

    for (const proxy of best.items) {
      if (!taken.has(proxy.snapshot.server))
        routes.push({ server: proxy.snapshot.server, session: null });
    }

    return routes;
  }
}
