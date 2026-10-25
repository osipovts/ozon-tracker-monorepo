export interface PaginationInterface {
  page: number;
  pageSize: number;
}

export interface PageInterface<ItemType> {
  items: ItemType[];
  total: number;
}
