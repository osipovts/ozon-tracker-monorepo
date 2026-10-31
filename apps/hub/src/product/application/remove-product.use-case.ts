import { errorMessage, type LoggerPort, silentLogger } from 'logger';

import type { ObjectStoragePort } from '../../shared/application/object-storage.port.js';
import { ProductNotFoundError } from './product-not-found.error.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

/** Stops tracking a product for a user; the product goes for good, with its picture, with its last tracker. */
export class RemoveProductUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly storage: Pick<ObjectStoragePort, 'enabled' | 'delete'>,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(userId: string, productId: string): Promise<void> {
    const key =
      (await this.products.findSubscribed(userId, productId))?.snapshot.thumbnailKey ?? null;
    if (!(await this.products.unsubscribe(userId, productId))) {
      throw new ProductNotFoundError(productId);
    }

    if (
      key !== null &&
      this.storage.enabled &&
      (await this.products.findById(productId)) === null
    ) {
      try {
        await this.storage.delete(key);
      } catch (error: unknown) {
        this.logger.warn(`The picture ${key} is left in the storage: ${errorMessage(error)}`);
      }
    }
  }
}
