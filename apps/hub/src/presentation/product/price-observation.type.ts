import { z } from 'zod';

export const priceObservationSchema = z.object({
  id: z.uuid(),
  observedAt: z.iso.datetime(),
  title: z.string(),
  availability: z.enum(['in_stock', 'out_of_stock', 'unknown']),
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
