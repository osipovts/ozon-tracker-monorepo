import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';
import { isFinished, jobQuery } from '../jobs/job-query.js';

export type HandbookType = operations['HandbooksController_list']['parameters']['path']['handbook'];
export type HandbookCitiesPageType =
  operations['HandbooksController_list']['responses'][200]['content']['application/json'];

export const handbookPageSize = 20;

export function useHandbookCities(
  handbook: HandbookType,
  query: string,
  page: number,
): UseQueryResult<HandbookCitiesPageType | undefined> {
  return useQuery({
    queryKey: ['handbook', handbook, { query, page }],
    queryFn: async (): Promise<HandbookCitiesPageType | undefined> =>
      ensure(
        await api.GET('/handbooks/{handbook}', {
          params: { path: { handbook }, query: { page, pageSize: handbookPageSize, query } },
        }),
      ),
    placeholderData: (previous): HandbookCitiesPageType | undefined => previous,
  });
}

/** Queues a read of the handbook and follows its job until it ends, which shows the new entries. */
export function useRefreshHandbook(handbook: HandbookType): {
  start: () => void;
  isRunning: boolean;
  percent: number | null;
  status: string | null;
  error: Error | null;
} {
  const client = useQueryClient();
  const refreshed = (): Promise<void> =>
    client.invalidateQueries({ queryKey: ['handbook', handbook] });
  const start = useMutation({
    mutationFn: async (): Promise<string | undefined> =>
      ensure(await api.POST('/handbooks/{handbook}/refresh', { params: { path: { handbook } } }))
        ?.jobId,
  });
  // After a reload the read that still runs is followed again.
  const running = useQuery({
    queryKey: ['handbook-jobs', 'running', handbook],
    queryFn: async (): Promise<string | undefined> => {
      const page = ensure(
        await api.GET('/jobs', { params: { query: { kind: 'handbook_fetch', pageSize: 100 } } }),
      );

      return page?.items.find((job): boolean => job.subject === handbook && !isFinished(job.status))
        ?.id;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const jobId = start.data ?? running.data;
  const job = useQuery({
    ...jobQuery(jobId ?? '', refreshed),
    enabled: jobId !== undefined,
  });
  const status = job.data?.status ?? (jobId === undefined ? null : 'queued');

  return {
    start: (): void => {
      start.mutate();
    },
    isRunning: start.isPending || running.isPending || (status !== null && !isFinished(status)),
    percent: job.data?.percent ?? null,
    status,
    error: start.error ?? job.error,
  };
}
