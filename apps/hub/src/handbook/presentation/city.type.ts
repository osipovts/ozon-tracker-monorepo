import { marketplaceSchema } from 'queue-contract';
import { z } from 'zod';

export const cityMarketplaceParamSchema = marketplaceSchema;

export const citySearchQuerySchema = z.object({
  /** A part of the name of the city, in any case; the first cities by name when empty. */
  query: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CitySearchQueryType = z.infer<typeof citySearchQuerySchema>;

export const cityListResponseSchema = z.object({
  items: z.array(
    z.object({
      /** The id the marketplace gives the city: what `POST /products` takes as `cityId`. */
      id: z.string(),
      name: z.string(),
      region: z.string().nullable(),
    }),
  ),
});

export type CityListResponseType = z.infer<typeof cityListResponseSchema>;
