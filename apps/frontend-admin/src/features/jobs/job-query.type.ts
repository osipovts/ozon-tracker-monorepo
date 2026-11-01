import type { UseQueryOptions } from '@tanstack/react-query';
import { ensure } from 'frontend-shared';

import { api } from '../../shared/api/api.client.js';

export function isFinished(status: string | undefined): boolean {
  return status === 'completed' || status === 'failed';
}

export interface JobProgressInterface {
  status: string;
  percent: number;
}

export type JobQueryType = UseQueryOptions<JobProgressInterface | undefined>;

/** Follows a job until it ends; `onFinished` runs with every read of an ended job. */
export function jobQuery(jobId: string, onFinished: () => Promise<void>): JobQueryType {
  return {
    queryKey: ['job', jobId],
    queryFn: async (): Promise<JobProgressInterface | undefined> => {
      const found = ensure(await api.GET('/jobs/{id}', { params: { path: { id: jobId } } }));
      if (isFinished(found?.status)) await onFinished();

      return found;
    },
    refetchInterval: (query): number | false =>
      isFinished(query.state.data?.status) ? false : 1000,
  };
}
