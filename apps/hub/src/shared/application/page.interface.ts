export interface PaginationInterface {
  page: number;
  pageSize: number;
}

export interface PageInterface<ItemType> {
  items: ItemType[];
  total: number;
}

/** The number of items before the page. */
export function pageOffset(pagination: PaginationInterface): number {
  return (pagination.page - 1) * pagination.pageSize;
}

/** Takes the page out of all the items, already sorted. */
export function pageOf<ItemType>(
  items: readonly ItemType[],
  pagination: PaginationInterface,
): PageInterface<ItemType> {
  const start = pageOffset(pagination);

  return { items: items.slice(start, start + pagination.pageSize), total: items.length };
}
