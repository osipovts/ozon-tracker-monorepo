import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';
import type { operations } from '../../shared/api/schema.js';

type AccountType =
  operations['AccountController_account']['responses'][200]['content']['application/json'];
export type LinkedProviderType = AccountType['identities'][number]['provider'];
export type AccountInfoType = AccountType;

type SessionListType =
  operations['AuthSessionsController_list']['responses'][200]['content']['application/json'];
export type DeviceSessionType = SessionListType['sessions'][number];

const sessionsKey = ['auth-sessions'] as const;

export function useDeviceSessions(): UseQueryResult<DeviceSessionType[]> {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: async (): Promise<DeviceSessionType[]> =>
      ensure(await api.GET('/auth/sessions'))?.sessions ?? [],
  });
}

export function useRevokeSession(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      ensure(await api.DELETE('/auth/sessions/{id}', { params: { path: { id } } }));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: sessionsKey }),
  });
}

export function useRevokeOtherSessions(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      ensure(await api.DELETE('/auth/sessions'));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: sessionsKey }),
  });
}

export function useChangePassword(): UseMutationResult<
  void,
  Error,
  { currentPassword: string; newPassword: string }
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (passwords: {
      currentPassword: string;
      newPassword: string;
    }): Promise<void> => {
      ensure(await api.POST('/auth/password', { body: passwords }));
    },
    // The other devices are signed out by the hub: the list is not what it was.
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: sessionsKey }),
  });
}

const accountKey = ['account'] as const;

export function useAccountInfo(): UseQueryResult<AccountInfoType | undefined> {
  return useQuery({
    queryKey: accountKey,
    queryFn: async (): Promise<AccountInfoType | undefined> =>
      ensure(await api.GET('/auth/account')),
  });
}

export function useUnlinkProvider(): UseMutationResult<void, Error, LinkedProviderType> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (provider: LinkedProviderType): Promise<void> => {
      ensure(await api.DELETE('/auth/identities/{provider}', { params: { path: { provider } } }));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: accountKey }),
  });
}

/** Deletes the account for good: what was read with it is not for whoever comes next. */
export function useDeleteAccount(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      ensure(await api.DELETE('/auth/account', { body: { email } }));
    },
    onSuccess: (): void => {
      client.clear();
    },
  });
}
