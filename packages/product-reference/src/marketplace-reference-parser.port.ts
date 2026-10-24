import type { MarketplaceType } from './marketplace.type.js';
import type { ProductReferenceEntity } from './product-reference.entity.js';

export interface MarketplaceReferenceParserPort {
  readonly marketplace: MarketplaceType;
  /** Returns null when the URL is not a product link of this marketplace. */
  parse(url: URL): ProductReferenceEntity | null;
}
