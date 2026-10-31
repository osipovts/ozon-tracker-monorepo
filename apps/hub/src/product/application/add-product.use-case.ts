import { errorMessage, type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity, ResolveProductReferenceUseCase } from 'product-reference';

import { enforceRateLimits } from '../../shared/application/enforce-rate-limits.type.js';
import type { RateLimiterPort } from '../../shared/application/rate-limiter.port.js';
import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import type { PriceObservationRepositoryPort } from './price-observation-repository.port.js';
import { ProductGoneError } from './product-gone.error.js';
import type { ProductLimitsInterface } from './product-quota.type.js';
import { ProductQuotaExceededError } from './product-quota-exceeded.error.js';
import type { RequestPriceObservationUseCase } from './request-price-observation.use-case.js';
import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from './tracked-product-repository.port.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

export interface AddedProductInterface {
  product: TrackedProductEntity;
  /** Whether the user tracks the product from now on, not whether it is new. */
  created: boolean;
  /** The job that reads the first price of a product that has none; null when there is nothing to read or no way to. */
  jobId: string | null;
}

/**
 * Starts tracking a product for a user by any link to it; the users share one product. A product that
 * has no price yet gets its first read queued when a user starts tracking it: there is no other way to ask for one, the refreshes
 * are for a schedule. A user is held to a number of products and to a rate of adding them.
 */
export class AddProductUseCase {
  constructor(
    private readonly resolveReference: ResolveProductReferenceUseCase,
    private readonly products: TrackedProductRepositoryPort,
    private readonly observations: PriceObservationRepositoryPort,
    private readonly requestObservation: Pick<RequestPriceObservationUseCase, 'execute'>,
    private readonly limiter: RateLimiterPort,
    private readonly limits: ProductLimitsInterface,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(userId: string, url: string): Promise<AddedProductInterface> {
    let reference: ProductReferenceEntity;
    try {
      reference = this.resolveReference.execute(url);
    } catch {
      throw new UnsupportedProductUrlError();
    }

    await enforceRateLimits(this.limiter, [[`product-add:user:${userId}`, this.limits.add]]);

    // Before the product is created: a refused one would be left, tracked by nobody.
    const tracking = await this.products.listSubscribed(userId, { page: 1, pageSize: 1 });
    if (tracking.total >= this.limits.maxProducts) {
      throw new ProductQuotaExceededError(this.limits.maxProducts);
    }

    const tracked = {
      marketplace: reference.marketplace,
      externalId: reference.id,
      url: reference.url,
    };

    let added: { product: TrackedProductEntity; created: boolean };
    try {
      added = await this.track(userId, tracked);
    } catch (error: unknown) {
      // The last tracker removed the product between the add and the subscribe: add it anew, once.
      if (!(error instanceof ProductGoneError)) throw error;

      added = await this.track(userId, tracked);
    }

    // Only a user who joins reads: adding a product again must not queue a job again.
    const jobId = added.created
      ? await this.readFirstPrice(userId, added.product.snapshot.id)
      : null;

    return { ...added, jobId };
  }

  private async track(
    userId: string,
    reference: TrackedProductReferenceInterface,
  ): Promise<{ product: TrackedProductEntity; created: boolean }> {
    const added = await this.products.add(reference);
    if (added.created)
      this.logger.info(
        `Tracking ${reference.marketplace} ${reference.externalId} as product ${added.product.snapshot.id}: ${reference.url}`,
      );

    const created = await this.products.subscribe(userId, added.product.snapshot.id);

    return { product: added.product, created };
  }

  /** The product is tracked whether or not its price can be read now: no proxy, or a queue that is down, is no reason to refuse it. */
  private async readFirstPrice(userId: string, productId: string): Promise<string | null> {
    if ((await this.observations.findLatestByProducts([productId])).length > 0) return null;

    try {
      return (await this.requestObservation.execute(userId, productId)).jobId;
    } catch (error: unknown) {
      this.logger.warn(
        `The first price of product ${productId} is not queued: ${errorMessage(error)}`,
      );

      return null;
    }
  }
}
