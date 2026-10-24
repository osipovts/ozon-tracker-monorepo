import type { MarketplaceType } from './marketplace.type.js';
import type { MarketplaceReferenceParserPort } from './marketplace-reference-parser.port.js';
import { ProductReferenceEntity } from './product-reference.entity.js';

export class OzonReferenceParser implements MarketplaceReferenceParserPort {
  readonly marketplace: MarketplaceType = 'ozon';

  parse(url: URL): ProductReferenceEntity | null {
    const id = /^\/product\/(?:[\w%-]+-)?(\d+)\/?$/.exec(url.pathname)?.[1];
    if (
      url.protocol !== 'https:' ||
      !['ozon.ru', 'www.ozon.ru'].includes(url.hostname) ||
      url.port !== '' ||
      url.username !== '' ||
      url.password !== '' ||
      id === undefined
    )
      return null;
    return new ProductReferenceEntity(this.marketplace, id, `https://www.ozon.ru/product/${id}/`);
  }
}
