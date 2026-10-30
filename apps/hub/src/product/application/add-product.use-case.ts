import { type LoggerPort, silentLogger } from 'logger';
import type { ProductReferenceEntity, ResolveProductReferenceUseCase } from 'product-reference';

import type { TrackedProductEntity } from '../domain/tracked-product.entity.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';
import { UnsupportedProductUrlError } from './unsupported-product-url.error.js';

/** Starts tracking a product by any link to it; a product is tracked once. */
export class AddProductUseCase {
  constructor(
    private readonly resolveReference: ResolveProductReferenceUseCase,
    private readonly products: TrackedProductRepositoryPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(url: string): Promise<{ product: TrackedProductEntity; created: boolean }> {
    let reference: ProductReferenceEntity;
    try {
      reference = this.resolveReference.execute(url);
    } catch {
      throw new UnsupportedProductUrlError();
    }

    const added = await this.products.add({
      marketplace: reference.marketplace,
      externalId: reference.id,
      url: reference.url,
    });
    if (added.created)
      this.logger.info(
        `Tracking ${reference.marketplace} ${reference.id} as product ${added.product.snapshot.id}: ${reference.url}`,
      );

    return added;
  }
}
