import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';

export type ProxyPageType =
  operations['ProxiesController_list']['responses'][200]['content']['application/json'];

export interface ProxyFilterInterface {
  alive: 'true' | 'false' | undefined;
  disabled: 'true' | 'false' | undefined;
  /** Whether the proxy has an active session of `sessionMarketplace`. */
  ready: 'true' | 'false' | undefined;
  page: number;
}

/** The marketplace whose sessions the list shows: the only one the hub reads so far. */
export const sessionMarketplace = 'ozon';

export const proxyPageSize = 20;

export function useProxies(
  filter: ProxyFilterInterface,
): UseQueryResult<ProxyPageType | undefined> {
  return useQuery({
    queryKey: ['proxies', filter],
    queryFn: async (): Promise<ProxyPageType | undefined> =>
      ensure(
        await api.GET('/proxies', {
          params: {
            query: {
              page: filter.page,
              pageSize: proxyPageSize,
              marketplace: sessionMarketplace,
              ...(filter.alive === undefined ? {} : { alive: filter.alive }),
              ...(filter.disabled === undefined ? {} : { disabled: filter.disabled }),
              ...(filter.ready === undefined ? {} : { ready: filter.ready }),
            },
          },
        }),
      ),
    placeholderData: (previous): ProxyPageType | undefined => previous,
  });
}

/** What the lists and the dashboard show of the proxies is stale once one is changed. */
function useRefreshedViews(): () => Promise<void> {
  const client = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['proxies'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };
}

export function useSetProxyDisabled(): UseMutationResult<
  void,
  Error,
  { server: string; disabled: boolean }
> {
  const refreshed = useRefreshedViews();

  return useMutation({
    mutationFn: async (change: { server: string; disabled: boolean }): Promise<void> => {
      ensure(
        await api.PATCH('/proxies', {
          params: { query: { server: change.server } },
          body: { disabled: change.disabled },
        }),
      );
    },
    onSuccess: refreshed,
  });
}

export function useDeleteProxy(): UseMutationResult<void, Error, string> {
  const refreshed = useRefreshedViews();

  return useMutation({
    mutationFn: async (server: string): Promise<void> => {
      ensure(await api.DELETE('/proxies', { params: { query: { server } } }));
    },
    onSuccess: refreshed,
  });
}

/** Queues the read of the source and follows its job until it ends. */
export function useRefreshSource(): {
  start: () => void;
  jobId: string | null;
  percent: number | null;
  status: string | null;
  error: Error | null;
  isStarting: boolean;
} {
  const refreshed = useRefreshedViews();
  const start = useMutation({
    mutationFn: async (): Promise<string | undefined> =>
      ensure(
        await api.POST('/proxy-sources/{source}/refresh', {
          params: { path: { source: 'github-free-proxy-list' } },
          body: {},
        }),
      )?.jobId,
  });
  const jobId = start.data ?? null;
  const job = useQuery({
    queryKey: ['job', jobId],
    enabled: jobId !== null,
    queryFn: async (): Promise<{ status: string; percent: number } | undefined> => {
      const found = ensure(await api.GET('/jobs/{id}', { params: { path: { id: jobId ?? '' } } }));
      if (found?.status === 'completed' || found?.status === 'failed') await refreshed();

      return found;
    },
    refetchInterval: (query): number | false => {
      const status = query.state.data?.status;

      return status === 'completed' || status === 'failed' ? false : 1000;
    },
  });

  return {
    start: (): void => {
      start.mutate();
    },
    jobId,
    percent: job.data?.percent ?? null,
    status: job.data?.status ?? null,
    error: start.error ?? job.error,
    isStarting: start.isPending,
  };
}
