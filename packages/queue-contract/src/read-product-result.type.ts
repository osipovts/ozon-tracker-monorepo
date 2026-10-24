import { z } from 'zod';

const priceObservationSchema = z.object({
  amountMinor: z.number().int(),
  currency: z.literal('RUB'),
});

export const productSnapshotSchema = z.object({
  productId: z.string(),
  url: z.string(),
  title: z.string(),
  observedAt: z.iso.datetime(),
  deliveryContext: z.literal('site_default'),
  prices: z.array(priceObservationSchema),
  availability: z.enum(['in_stock', 'out_of_stock', 'unknown']),
});

export type ProductSnapshotType = z.infer<typeof productSnapshotSchema>;

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

export type ReadProductResultSchemaType = z.infer<typeof readProductResultSchema>;
