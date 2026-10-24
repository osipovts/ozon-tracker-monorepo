import type { MarketplaceType } from './marketplace.type.js';

export class ProductReferenceEntity {
  constructor(
    readonly marketplace: MarketplaceType,
    readonly id: string,
    readonly url: string,
  ) {}
}
