import type { z } from 'zod';

import { pageResponseSchema } from '../shared/pagination-query.type.js';
import { priceObservationSchema } from './price-observation.type.js';
import { productSchema } from './product.type.js';

export const priceHistoryResponseSchema = pageResponseSchema(priceObservationSchema).extend({
  product: productSchema,
});

export type PriceHistoryResponseType = z.infer<typeof priceHistoryResponseSchema>;
