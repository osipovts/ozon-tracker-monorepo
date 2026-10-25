import { z } from 'zod';

import { pageResponseSchema } from '../shared/pagination-query.type.js';
import { priceObservationSchema } from './price-observation.type.js';

export const productIdParamSchema = z.uuid();

export const productCreateBodySchema = z.object({
  /** Product page URL of a supported marketplace; share links are canonicalized. */
  url: z.url(),
});

export type ProductCreateBodyType = z.infer<typeof productCreateBodySchema>;

export const productSchema = z.object({
  id: z.uuid(),
  marketplace: z.string(),
  /** The id of the product on the marketplace. */
  externalId: z.string(),
  /** Canonical link to the product page on the marketplace. */
  url: z.string(),
  /** Status of the last fetch, including failed ones. */
  lastStatus: z.string().nullable(),
  lastCheckedAt: z.iso.datetime().nullable(),
});

export type ProductType = z.infer<typeof productSchema>;

export const productListItemSchema = productSchema.extend({
  /** The newest price observation, null until the first one is recorded. */
  latest: priceObservationSchema.nullable(),
});

export const productListResponseSchema = pageResponseSchema(productListItemSchema);

export type ProductListResponseType = z.infer<typeof productListResponseSchema>;
