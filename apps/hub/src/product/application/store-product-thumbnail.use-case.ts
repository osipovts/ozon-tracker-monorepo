import { errorMessage, type LoggerPort, silentLogger } from 'logger';

import type { ObjectStoragePort } from '../../shared/application/object-storage.port.js';
import type { ImageDownloaderPort } from './image-downloader.port.js';
import type { TrackedProductRepositoryPort } from './tracked-product-repository.port.js';

/** Where the picture of a product is kept: one file for a product, which a new picture replaces. */
export function thumbnailKeyOf(productId: string): string {
  return `products/${productId}/thumbnail`;
}

/**
 * Keeps a copy of the picture a worker saw on the page of a product, so that the pages of the hub do not
 * load it from the marketplace. A picture that is kept already is not downloaded again. A picture that cannot
 * be kept is no reason to fail the result it came with: the product is shown with a placeholder.
 */
export class StoreProductThumbnailUseCase {
  constructor(
    private readonly products: TrackedProductRepositoryPort,
    private readonly storage: Pick<ObjectStoragePort, 'enabled' | 'put'>,
    private readonly downloader: ImageDownloaderPort,
    private readonly logger: LoggerPort = silentLogger,
  ) {}

  async execute(productId: string, imageUrl: string | null): Promise<void> {
    if (!this.storage.enabled || imageUrl === null) return;

    try {
      const product = await this.products.findById(productId);
      if (product === null) return;

      const { thumbnailKey, thumbnailSourceUrl } = product.snapshot;
      if (thumbnailKey !== null && thumbnailSourceUrl === imageUrl) return;

      const image = await this.downloader.download(imageUrl);
      if (image === null) {
        this.logger.warn(
          `The picture of product ${productId} is not kept: ${imageUrl} gave no picture`,
        );

        return;
      }

      const key = thumbnailKeyOf(productId);
      await this.storage.put(key, image);
      await this.products.setThumbnail(productId, key, imageUrl);
    } catch (error: unknown) {
      this.logger.warn(`The picture of product ${productId} is not kept: ${errorMessage(error)}`);
    }
  }
}
