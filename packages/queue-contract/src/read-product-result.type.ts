import { z } from 'zod';

const priceObservationSchema = z.object({
  amountMinor: z.number().int(),
  currency: z.literal('RUB'),
});

const productSnapshotSchema = z.object({
  title: z.string(),
  observedAt: z.iso.datetime(),
  prices: z.array(priceObservationSchema),
  availability: z.enum(['in_stock', 'out_of_stock', 'unknown']),
});

export const readProductResultSchema = z.union([
  z.object({
    status: z.enum(['success', 'partial']),
    snapshot: productSnapshotSchema,
    exitIp: z.string().nullable(),
  }),
  z.object({
    status: z.enum([
      'challenge_required',
      'network_error',
      'proxy_rejected',
      'parse_error',
      'http_error',
    ]),
    httpStatus: z.number().int().optional(),
  }),
]);
