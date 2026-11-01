import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ensure } from 'frontend-shared';

import { api } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';
import {
  forgetPendingAdd,
  type PendingAddInterface,
  rememberPendingAdd,
} from './pending-add.type.js';
import {
  historyPageSize,
  loadPriceHistory,
  type PriceHistoryInterface,
} from './price-history.type.js';

export type ProductPageType =
  operations['ProductsController_list']['responses'][200]['content']['application/json'];
export type ProductListItemType = ProductPageType['items'][number];

type PriceHistoryPageType =
  operations['ProductsController_prices']['responses'][200]['content']['application/json'];
export type ObservationType = PriceHistoryPageType['items'][number];

export type ProductHistoryType = PriceHistoryInterface<
  PriceHistoryPageType['product'],
  ObservationType
>;

export const productPageSize = 20;

/** How long to wait for the first price of a product that has none yet, in milliseconds. */
const firstPricePollMs = 3000;

/** How long after a read the list waits for the picture of a product that has none. */
const pictureWaitMs = 2 * 60_000;

/** A product that has no price yet, or has just been read and has no picture yet. */
function isAwaitingData(item: ProductListItemType): boolean {
  if (item.latest === null) return true;

  return (
    item.thumbnailUrl === null &&
    (item.lastCheckedAt === null || Date.now() - Date.parse(item.lastCheckedAt) < pictureWaitMs)
  );
}

export function useProducts(page: number): UseQueryResult<ProductPageType | undefined> {
  return useQuery({
    queryKey: ['products', page],
    queryFn: async (): Promise<ProductPageType | undefined> =>
      ensure(
        await api.GET('/products', { params: { query: { page, pageSize: productPageSize } } }),
      ),
    placeholderData: (previous): ProductPageType | undefined => previous,
    // A product that was just added has no price until a worker reads it, and no picture until it is kept.
    refetchInterval: (query): number | false =>
      query.state.data?.items.some(isAwaitingData) === true ? firstPricePollMs : false,
  });
}

export function useAddProduct(): UseMutationResult<void, Error, PendingAddInterface> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (add: PendingAddInterface): Promise<void> => {
      rememberPendingAdd(add);
      ensure(
        await api.POST('/products', {
          body: add.cityId === null ? { url: add.url } : { url: add.url, cityId: add.cityId },
        }),
      );
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: ['products'] }),
    // Here, not in the call: the page that made it may be gone by then.
    onSettled: forgetPendingAdd,
  });
}

export function useDeleteProduct(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      ensure(await api.DELETE('/products/{id}', { params: { path: { id } } }));
    },
    onSuccess: async (_data, id): Promise<void> => {
      client.removeQueries({ queryKey: ['price-history', id] });
      await client.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function usePriceHistory(id: string): UseQueryResult<ProductHistoryType | undefined> {
  const client = useQueryClient();
  const key = ['price-history', id];

  return useQuery({
    queryKey: key,
    // What the page has of the history stays: a refresh asks for what is newer only.
    queryFn: (): Promise<ProductHistoryType | undefined> =>
      loadPriceHistory(
        async (page) =>
          ensure(
            await api.GET('/products/{id}/prices', {
              params: { path: { id }, query: { page, pageSize: historyPageSize } },
            }),
          ),
        client.getQueryData<ProductHistoryType>(key),
      ),
    refetchInterval: 60_000,
  });
}

export type CityType =
  operations['CitiesController_list']['responses'][200]['content']['application/json']['items'][number];

/** The cities of DNS whose names have the query in them, for the user to choose from. */
export function useCities(query: string, enabled: boolean): UseQueryResult<CityType[] | undefined> {
  return useQuery({
    queryKey: ['cities', 'dns', query],
    queryFn: async (): Promise<CityType[] | undefined> =>
      ensure(
        await api.GET('/marketplaces/{marketplace}/cities', {
          params: { path: { marketplace: 'dns' }, query: { query, limit: 20 } },
        }),
      )?.items,
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (previous): CityType[] | undefined => previous,
  });
}
