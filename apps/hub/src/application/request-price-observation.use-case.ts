import { randomUUID } from 'node:crypto';

import { type LoggerPort, silentLogger } from 'logger';

import { JobEntity } from '../domain/job.entity.js';
import type { BrowserSessionRepositoryPort } from './browser-session-repository.port.js';
import type { JobQueuePort, RouteInterface } from './job-queue.port.js';
import type { JobRepositoryPort } from './job-repository.port.js';
import { NoProxiesAvailableError } from './no-proxies-available.error.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import type { ProxyRepositoryPort } from './proxy-repository.port.js';
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
    const product = await this.products.findById(productId);
    if (product === null) throw new ProductNotFoundError(productId);
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
  private async chooseRoutes(marketplace: string): Promise<RouteInterface[]> {
    const routes: RouteInterface[] = (await this.sessions.listActive(marketplace)).map(
      (session): RouteInterface => ({
        server: session.snapshot.proxyServer,
        session: {
          id: session.snapshot.id,
          exitIp: session.snapshot.exitIp,
          userAgent: session.snapshot.userAgent,
          platform: session.snapshot.platform,
          browserVersion: session.snapshot.browserVersion,
          storageState: session.snapshot.storageState,
        },
      }),
    );
    const taken = new Set(routes.map((route): string | null => route.server));
    // The workers accept Russian exits only: other proxies would be rejected anyway.
    const best = await this.proxies.list(
      { alive: true, country: 'RU' },
      { page: 1, pageSize: this.settings.proxyCount },
    );
    for (const proxy of best.items) {
      if (!taken.has(proxy.server)) routes.push({ server: proxy.server, session: null });
    }
    return routes;
  }
}
