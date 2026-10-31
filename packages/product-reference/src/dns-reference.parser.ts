import type { MarketplaceType } from './marketplace.type.js';
import type { MarketplaceReferenceParserPort } from './marketplace-reference-parser.port.js';
import { ProductReferenceEntity } from './product-reference.entity.js';

export class DnsReferenceParser implements MarketplaceReferenceParserPort {
  readonly marketplace: MarketplaceType = 'dns';

  parse(url: URL): ProductReferenceEntity | null {
    // The page of the analogs of a product that is out of stock stands for the product.
    const id = /^\/product\/(?:analog\/)?([\da-f]{16})(?:\/|$)/i.exec(url.pathname)?.[1];
    if (
      url.protocol !== 'https:' ||
      !['dns-shop.ru', 'www.dns-shop.ru'].includes(url.hostname) ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      id === undefined
    )
      return null;

    const canonicalId = id.toLowerCase();

    return new ProductReferenceEntity(
      this.marketplace,
      canonicalId,
      `https://www.dns-shop.ru/product/${canonicalId}/`,
    );
  }
}
