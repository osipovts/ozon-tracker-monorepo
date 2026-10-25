import type { ProductReferenceEntity } from 'product-reference';
import { OzonReferenceParser } from 'product-reference';
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
  offers: z.union([offerSchema, z.array(offerSchema)]).optional(),
});
const graphSchema = z.object({ '@graph': z.array(z.unknown()) });
const moneyPattern = /(\d+(?:\p{Zs}\d{3})*(?:[,.]\d{1,2})?)\s*(?:₽|руб\.?)/giu;

export class OzonProductParser {
  private readonly references = new OzonReferenceParser();

  isChallenge(page: OzonPageInterface): boolean {
    return /antibot|captcha|доступ ограничен|подтвердите,? что вы|проверка безопасности/i.test(
      `${page.title}\n${page.body.slice(0, 4000)}`,
    );
  }

  parse(
    reference: ProductReferenceEntity,
    page: OzonPageInterface,
  ): ProductSnapshotInterface | null {
    let title = page.heading;
    const prices: PriceObservationInterface[] = [];
    let availability: ProductSnapshotInterface['availability'] = 'unknown';
    for (const text of page.structuredData) {
      for (const value of this.readStructuredData(text)) {
        const product = productSchema.safeParse(value);
        if (!product.success) continue;
        if (product.data.sku !== undefined) {
          if (String(product.data.sku) !== reference.id) continue;
        } else {
          try {
            if (
              product.data.url === undefined ||
              this.references.parse(new URL(product.data.url))?.id !== reference.id
            )
              continue;
          } catch {
            continue;
          }
        }
        title ||= product.data.name;
        const offers =
          product.data.offers === undefined
            ? []
            : Array.isArray(product.data.offers)
              ? product.data.offers
              : [product.data.offers];
        // Multiple offers may refer to other sellers: do not select their minimum.
        if (offers.length !== 1) continue;
        const offer = offers[0];
        if (offer === undefined) continue;
        const amount = this.parseAmount(String(offer.price));
        if (amount !== null) prices.push({ amountMinor: amount, currency: 'RUB' });
        if (offer.availability?.endsWith('/InStock') === true) availability = 'in_stock';
        if (offer.availability?.endsWith('/OutOfStock') === true) availability = 'out_of_stock';
      }
    }
    const widgetPrices: PriceObservationInterface[] = [];
    let previousEnd = 0;
    for (const match of page.priceText.matchAll(moneyPattern)) {
      const amount = this.parseAmount(match[1] ?? '');
      const preceding = page.priceText.slice(previousEnd, match.index);
      previousEnd = match.index + match[0].length;
      const following = page.priceText.slice(match.index + match[0].length).trimStart();
      if (
        amount === null ||
        /тамож|пошлин|доставк|бонус|кешбэк/i.test(preceding) ||
        /^(?:\/\s*мес|в месяц|за месяц)/i.test(following)
      )
        continue;
      widgetPrices.push({ amountMinor: amount, currency: 'RUB' });
    }
    // Prefer rendered prices over possibly stale structured markup.
    if (widgetPrices.length > 0) prices.splice(0, prices.length, ...widgetPrices);
    const purchase = page.purchaseText;
    if (/нет в наличии|товар закончился|узнать о поступлении/i.test(purchase))
      availability = 'out_of_stock';
    else if (/в корзину|купить сейчас/i.test(purchase)) availability = 'in_stock';
    if (title === '' || (prices.length === 0 && availability !== 'out_of_stock')) return null;
    return {
      productId: reference.id,
      url: reference.url,
      title,
      observedAt: new Date().toISOString(),
      deliveryContext: 'site_default',
      prices,
      availability,
    };
  }

  private parseAmount(input: string): number | null {
    const normalized = input.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
    const amount = Math.round(Number(normalized) * 100);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  private readStructuredData(text: string): unknown[] {
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
