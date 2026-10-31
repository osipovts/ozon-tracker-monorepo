import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';

export type DashboardType =
  operations['AdminController_dashboard']['responses'][200]['content']['application/json'];

export function useDashboard(): UseQueryResult<DashboardType | undefined> {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardType | undefined> =>
      ensure(await api.GET('/admin/dashboard')),
    refetchInterval: 30_000,
  });
}
