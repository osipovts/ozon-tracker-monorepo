import type { MarketplaceReferenceParserPort, ProductReferenceEntity } from 'product-reference';
import { z } from 'zod';

import type {
  PriceObservationInterface,
  ProductSnapshotInterface,
} from '../../domain/product/product-snapshot.interface.js';
import type { OzonPageInterface } from './ozon-page.interface.js';

const offerSchema = z.object({
  price: z.union([z.string(), z.number()]),
  priceCurrency: z.literal('RUB'),
  availability: z.string().optional(),
});
const productSchema = z.object({
  '@type': z.literal('Product'),
  sku: z.union([z.string(), z.number()]).optional(),
  url: z.string().optional(),
  name: z.string(),
  image: z.union([z.string(), z.array(z.string())]).optional(),
  offers: z.union([offerSchema, z.array(offerSchema)]).optional(),
});
const graphSchema = z.object({ '@graph': z.array(z.unknown()) });
const moneyLinePattern = /^[\d\p{Zs},.]+\s*(?:₽|руб\.?)$/iu;
const moneyPattern = /(\d+(?:\p{Zs}\d{3})*(?:[,.]\d{1,2})?)\s*(?:₽|руб\.?)/giu;

/** What the JSON-LD markup of the page tells about the product. */
interface StructuredProductInterface {
  title: string;
  prices: PriceObservationInterface[];
  availability: ProductSnapshotInterface['availability'];
  imageUrl: string | null;
}

/** The pictures of Ozon are served in sizes, named by the folder before the file: `wc300` is 300 pixels wide, in WebP. */
const ozonPicturePath = /^(\/s3\/[^/]+\/)(?:w?c\d+\/)?([^/]+)$/;
const thumbnailFolder = 'wc300';

/**
 * An address a browser can load: the page may give a relative one, or none. A picture of the CDN of Ozon is
 * the small size of it: a card shows it at less than 120 pixels, and the full size is hundreds of kilobytes.
 */
function httpUrlOf(value: string | undefined): string | null {
  if (value === undefined || value === '') return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const parts = url.hostname === 'ir.ozone.ru' ? ozonPicturePath.exec(url.pathname) : null;
    if (parts?.[1] !== undefined && parts[2] !== undefined) {
      url.pathname = `${parts[1]}${thumbnailFolder}/${parts[2]}`;
    }

    return url.href;
  } catch {
    return null;
  }
}

export class OzonProductParser {
  constructor(private readonly references: MarketplaceReferenceParserPort) {}

  /** Returns null when the page is not the card of the product or shows no price. */
  parse(
    reference: ProductReferenceEntity,
    page: OzonPageInterface,
  ): ProductSnapshotInterface | null {
    if (!this.isPageOf(reference, page.url)) return this.readOutOfStockRedirect(page);

    const structured = this.readStructuredData(reference, page.structuredData);
    const widgetPrices = this.readWidgetPrices(page.priceText);
    // Prefer rendered prices over possibly stale structured markup.
    const prices = widgetPrices.length > 0 ? widgetPrices : structured.prices;
    const availability =
      page.outOfStockText === ''
        ? (this.readAvailability(page.purchaseText) ?? structured.availability)
        : 'out_of_stock';
    const title = page.heading || structured.title;
    if (title === '' || (prices.length === 0 && availability !== 'out_of_stock')) return null;

    return {
      title,
      observedAt: new Date().toISOString(),
      prices,
      availability,
      imageUrl: structured.imageUrl ?? httpUrlOf(page.imageUrl),
    };
  }

  /**
   * Ozon sends the address of a product that is out of stock to a search for its name, where the product is
   * shown as sold out. The page does not name the product, but only the product we asked for leads there.
   */
  private readOutOfStockRedirect(page: OzonPageInterface): ProductSnapshotInterface | null {
    try {
      const url = new URL(page.url);
      if (!/(?:^|\.)ozon\.ru$/.test(url.hostname) || !url.pathname.startsWith('/search/'))
        return null;
    } catch {
      return null;
    }

    // The widget gives the last price the product had, which is kept as the price: the title is its other line.
    const title = page.outOfStockText
      .split('\n')
      .map((line): string => line.trim())
      .find((line): boolean => line !== '' && !moneyLinePattern.test(line));
    if (title === undefined) return null;

    return {
      title,
      observedAt: new Date().toISOString(),
      prices: this.readWidgetPrices(page.outOfStockText),
      availability: 'out_of_stock',
      // The page names the picture of Ozon itself, not of the product.
      imageUrl: null,
    };
  }

  private isPageOf(reference: ProductReferenceEntity, url: string): boolean {
    try {
      return this.references.parse(new URL(url))?.id === reference.id;
    } catch {
      return false;
    }
  }

  private readStructuredData(
    reference: ProductReferenceEntity,
    texts: readonly string[],
  ): StructuredProductInterface {
    const structured: StructuredProductInterface = {
      title: '',
      prices: [],
      availability: 'unknown',
      imageUrl: null,
    };

    for (const text of texts) {
      for (const value of this.parseJson(text)) {
        const product = productSchema.safeParse(value);
        if (!product.success) continue;

        const matches =
          product.data.sku === undefined
            ? product.data.url !== undefined && this.isPageOf(reference, product.data.url)
            : String(product.data.sku) === reference.id;
        if (!matches) continue;

        structured.title ||= product.data.name;
        structured.imageUrl ??= httpUrlOf(
          Array.isArray(product.data.image) ? product.data.image[0] : product.data.image,
        );
        const offers =
          product.data.offers === undefined
            ? []
            : Array.isArray(product.data.offers)
              ? product.data.offers
              : [product.data.offers];

        // Multiple offers may refer to other sellers: do not select their minimum.
        const [offer] = offers;
        if (offers.length !== 1 || offer === undefined) continue;

        const amount = this.parseAmount(String(offer.price));
        if (amount !== null) structured.prices.push({ amountMinor: amount, currency: 'RUB' });
        if (offer.availability?.endsWith('/InStock') === true) structured.availability = 'in_stock';
        if (offer.availability?.endsWith('/OutOfStock') === true)
          structured.availability = 'out_of_stock';
      }
    }

    return structured;
  }

  private readWidgetPrices(priceText: string): PriceObservationInterface[] {
    const prices: PriceObservationInterface[] = [];
    let previousEnd = 0;

    for (const match of priceText.matchAll(moneyPattern)) {
      const amount = this.parseAmount(match[1] ?? '');
      const preceding = priceText.slice(previousEnd, match.index);
      previousEnd = match.index + match[0].length;
      const following = priceText.slice(match.index + match[0].length).trimStart();

      if (
        amount === null ||
        /тамож|пошлин|доставк|бонус|кешбэк/i.test(preceding) ||
        /^(?:\/\s*мес|в месяц|за месяц)/i.test(following)
      )
        continue;

      prices.push({ amountMinor: amount, currency: 'RUB' });
    }

    return prices;
  }

  /** Returns null when the purchase widgets say nothing about the availability. */
  private readAvailability(purchaseText: string): ProductSnapshotInterface['availability'] | null {
    if (/нет в наличии|товар закончился|узнать о поступлении/i.test(purchaseText))
      return 'out_of_stock';
    if (/в корзину|купить сейчас/i.test(purchaseText)) return 'in_stock';

    return null;
  }

  private parseAmount(input: string): number | null {
    const normalized = input.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

    const amount = Math.round(Number(normalized) * 100);

    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  private parseJson(text: string): unknown[] {
    try {
      const value: unknown = JSON.parse(text);
      if (Array.isArray(value)) return z.array(z.unknown()).parse(value);

      const graph = graphSchema.safeParse(value);

      return graph.success ? graph.data['@graph'] : [value];
    } catch {
      return [];
    }
  }
}
