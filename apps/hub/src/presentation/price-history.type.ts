import { z } from 'zod';

import { priceObservationSchema } from './price-observation.type.js';
import { productSchema } from './product.type.js';

export const priceHistoryResponseSchema = z.object({
  product: productSchema,
  items: z.array(priceObservationSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export type PriceHistoryResponseType = z.infer<typeof priceHistoryResponseSchema>;
