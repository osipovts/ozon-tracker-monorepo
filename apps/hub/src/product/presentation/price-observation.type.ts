import { z } from 'zod';

import { availabilities } from '../domain/price-observation.interface.js';

export const priceObservationSchema = z.object({
  id: z.uuid(),
  observedAt: z.iso.datetime(),
  title: z.string(),
  availability: z.enum(availabilities),
  /** Amounts are in kopecks. */
  prices: z.array(
    z.object({
      amountMinor: z.number().int(),
      currency: z.literal('RUB'),
    }),
  ),
  exitIp: z.string().nullable(),
});

export type PriceObservationType = z.infer<typeof priceObservationSchema>;
