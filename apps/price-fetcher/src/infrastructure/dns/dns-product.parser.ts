import type { MarketplaceReferenceParserPort, ProductReferenceEntity } from 'product-reference';

import type { ProductSnapshotInterface } from '../../domain/product/product-snapshot.interface.js';
import type { DnsPageInterface } from './dns-page.interface.js';

const pricePattern = /(\d[\d\p{Zs}]*)\p{Zs}*₽/u;

/** An address a browser can load; the page may give a relative one, or none. */
function httpUrlOf(value: string): string | null {
  try {
    const { protocol, href } = new URL(value);

    return protocol === 'https:' || protocol === 'http:' ? href : null;
  } catch {
    return null;
  }
}

export class DnsProductParser {
  constructor(private readonly references: MarketplaceReferenceParserPort) {}

  /** Returns null when the page is not the card of the product or shows no price. */
  parse(
    reference: ProductReferenceEntity,
    page: DnsPageInterface,
  ): ProductSnapshotInterface | null {
    const amountMinor = this.readAmountMinor(page.priceText);
    if (!this.isPageOf(reference, page.url) || page.heading === '' || amountMinor === null)
      return null;

    return {
      title: page.heading,
      observedAt: new Date().toISOString(),
      prices: [{ amountMinor, currency: 'RUB' }],
      availability: this.readAvailability(page),
      imageUrl: httpUrlOf(page.imageUrl),
    };
  }

  /** The price stays on the card of a product that is out of stock, so the buttons tell them apart. */
  private readAvailability(page: DnsPageInterface): ProductSnapshotInterface['availability'] {
    if (page.hasBuyButton) return 'in_stock';

    return page.hasNotifyButton ? 'out_of_stock' : 'unknown';
  }

  private readAmountMinor(priceText: string): number | null {
    const rubles = pricePattern.exec(priceText)?.[1]?.replace(/\p{Zs}/gu, '');
    const amountMinor = rubles === undefined ? NaN : Number(rubles) * 100;

    return Number.isSafeInteger(amountMinor) ? amountMinor : null;
  }

  private isPageOf(reference: ProductReferenceEntity, url: string): boolean {
    try {
      return this.references.parse(new URL(url))?.id === reference.id;
    } catch {
      return false;
    }
  }
}
