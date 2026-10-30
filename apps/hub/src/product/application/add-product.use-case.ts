import { type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity, ResolveProductReferenceUseCase } from 'product-reference';

import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import { ProductGoneError } from './product-gone.error.js';
import type {
  TrackedProductReferenceInterface,
  TrackedProductRepositoryPort,
} from './tracked-product-repository.port.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

/** Starts tracking a product for a user by any link to it; the users share one product. */
export class AddProductUseCase {
  constructor(
    private readonly resolveReference: ResolveProductReferenceUseCase,
    private readonly products: TrackedProductRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  /** `created` tells whether the user tracks the product from now on, not whether it is new. */
  async execute(
    userId: string,
    url: string,
  ): Promise<{ product: TrackedProductEntity; created: boolean }> {
    let reference: ProductReferenceEntity;
    try {
      reference = this.resolveReference.execute(url);
    } catch {
      throw new UnsupportedProductUrlError();
    }

    const tracked = {
      marketplace: reference.marketplace,
      externalId: reference.id,
      url: reference.url,
    };

    try {
      return await this.track(userId, tracked);
    } catch (error: unknown) {
      // The last tracker removed the product between the add and the subscribe: add it anew, once.
      if (!(error instanceof ProductGoneError)) throw error;

      return this.track(userId, tracked);
    }
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
}
