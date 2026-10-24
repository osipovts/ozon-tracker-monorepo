import type { MarketplaceType } from 'product-reference';
import type { ProductReferenceEntity } from 'product-reference';
import type { ProxyEndpointEntity } from 'proxy-endpoint';

import type { ProductReaderPort } from '../application/product-reader.port.js';
import type { ReadProductResultType } from '../domain/product-snapshot.interface.js';

/** Routes a product reference to the reader of its marketplace. */
export class MarketplaceProductReaderAdapter implements ProductReaderPort {
  constructor(private readonly readers: Record<MarketplaceType, ProductReaderPort>) {}

  read(
    reference: ProductReferenceEntity,
    proxy: ProxyEndpointEntity | null,
    signal: AbortSignal,
  ): Promise<ReadProductResultType> {
    return this.readers[reference.marketplace].read(reference, proxy, signal);
  }
}
