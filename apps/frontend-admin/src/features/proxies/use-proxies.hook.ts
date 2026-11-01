import {
  useMutation,
  type UseMutationResult,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ensure } from 'frontend-shared';

import { api } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';
import { isFinished, jobQuery, type JobQueryType } from '../jobs/job-query.js';

export type ProxyPageType =
  operations['ProxiesController_list']['responses'][200]['content']['application/json'];

export interface ProxyFilterInterface {
  alive: 'true' | 'false' | undefined;
  disabled: 'true' | 'false' | undefined;
  page: number;
}

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
              ...(filter.alive === undefined ? {} : { alive: filter.alive }),
              ...(filter.disabled === undefined ? {} : { disabled: filter.disabled }),
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

export function useAddProxy(): UseMutationResult<void, Error, string> {
  const refreshed = useRefreshedViews();

  return useMutation({
    mutationFn: async (server: string): Promise<void> => {
      ensure(await api.POST('/proxies', { body: { server } }));
    },
    onSuccess: refreshed,
  });
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

export function useDeleteAllProxies(): UseMutationResult<void, Error, void> {
  const refreshed = useRefreshedViews();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      ensure(await api.DELETE('/proxies/all'));
    },
    onSuccess: refreshed,
  });
}

export type ProxySourceType =
  operations['ProxySourcesController_refresh']['parameters']['path']['source'];

export const proxySources: readonly ProxySourceType[] = [
  'github-free-proxy-list',
  'proxifly',
  'proxyscrape',
];

/** Queues the read of the sources and follows their jobs until they end. */
export function useRefreshSources(): {
  start: (sources: readonly ProxySourceType[]) => void;
  jobIds: string[];
  percent: number | null;
  status: string | null;
  error: Error | null;
  isStarting: boolean;
} {
  const refreshed = useRefreshedViews();
  const start = useMutation({
    mutationFn: async (sources: readonly ProxySourceType[]): Promise<string[]> => {
      const jobs = await Promise.all(
        sources.map(
          async (source): Promise<string | undefined> =>
            ensure(
              await api.POST('/proxy-sources/{source}/refresh', {
                params: { path: { source } },
                body: {},
              }),
            )?.jobId,
        ),
      );

      return jobs.filter((jobId): jobId is string => jobId !== undefined);
    },
  });
  // After a reload the jobs that still run are followed again.
  const running = useQuery({
    queryKey: ['proxy-jobs', 'running'],
    queryFn: async (): Promise<string[]> => {
      const page = ensure(
        await api.GET('/jobs', { params: { query: { kind: 'proxy_fetch', pageSize: 100 } } }),
      );

      return (page?.items ?? [])
        .filter((job): boolean => !isFinished(job.status))
        .map((job): string => job.id);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const jobIds = start.data ?? running.data ?? [];
  const jobs = useQueries({
    queries: jobIds.map((jobId): JobQueryType => jobQuery(jobId, refreshed)),
  });
  const statuses = jobs.map((job): string | undefined => job.data?.status);
  const unfinished = statuses.find((status): boolean => !isFinished(status));

  return {
    start: (sources): void => {
      start.mutate(sources);
    },
    jobIds,
    percent:
      jobs.length === 0
        ? null
        : Math.round(jobs.reduce((sum, job) => sum + (job.data?.percent ?? 0), 0) / jobs.length),
    status:
      jobs.length === 0
        ? null
        : unfinished !== undefined || statuses.includes(undefined)
          ? (unfinished ?? 'queued')
          : statuses.includes('failed')
            ? 'failed'
            : 'completed',
    error: start.error ?? jobs.find((job) => job.error !== null)?.error ?? null,
    isStarting: start.isPending || running.isPending,
  };
}
