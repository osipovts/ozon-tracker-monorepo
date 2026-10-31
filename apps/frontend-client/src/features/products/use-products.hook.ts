import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';
import { forgetPendingAdd, rememberPendingAdd } from './pending-add.type.js';

export type ProductPageType =
  operations['ProductsController_list']['responses'][200]['content']['application/json'];
export type ProductListItemType = ProductPageType['items'][number];

type PriceHistoryPageType =
  operations['ProductsController_prices']['responses'][200]['content']['application/json'];
export type ObservationType = PriceHistoryPageType['items'][number];

export interface PriceHistoryInterface {
  product: PriceHistoryPageType['product'];
  /** The newest first, all of them. */
  observations: ObservationType[];
}

export const productPageSize = 20;

/** The page of the history the hub gives at most. */
const historyPageSize = 100;
/** A product read every few hours does not get past this in years. */
const historyPagesMax = 50;

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

export function useAddProduct(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (url: string): Promise<void> => {
      rememberPendingAdd(url);
      ensure(await api.POST('/products', { body: { url } }));
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

export function usePriceHistory(id: string): UseQueryResult<PriceHistoryInterface | undefined> {
  return useQuery({
    queryKey: ['price-history', id],
    queryFn: async (): Promise<PriceHistoryInterface | undefined> => {
      const observations: ObservationType[] = [];
      let product: PriceHistoryPageType['product'] | undefined;

      for (let page = 1; page <= historyPagesMax; page += 1) {
        const loaded = ensure(
          await api.GET('/products/{id}/prices', {
            params: { path: { id }, query: { page, pageSize: historyPageSize } },
          }),
        );
        if (loaded === undefined) break;

        product = loaded.product;
        observations.push(...loaded.items);
        if (observations.length >= loaded.total || loaded.items.length === 0) break;
      }

      return product === undefined ? undefined : { product, observations };
    },
    refetchInterval: 60_000,
  });
}
