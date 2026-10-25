import { z } from 'zod';

import type { PageInterface } from '../../application/shared/page.interface.js';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQueryType = z.infer<typeof paginationQuerySchema>;

/** A page of items with the pagination it was asked with. */
export function pageResponseSchema<ItemSchemaType extends z.ZodType>(
  item: ItemSchemaType,
): z.ZodObject<{
  items: z.ZodArray<ItemSchemaType>;
  page: z.ZodNumber;
  pageSize: z.ZodNumber;
  total: z.ZodNumber;
}> {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export function toPageResponse<ItemType, ResponseItemType>(
  page: PageInterface<ItemType>,
  query: PaginationQueryType,
  toItem: (item: ItemType) => ResponseItemType,
): { items: ResponseItemType[]; page: number; pageSize: number; total: number } {
  return {
    items: page.items.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total: page.total,
  };
}
