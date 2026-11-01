import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { ensure } from 'frontend-shared';

import { api } from '../../shared/api/api.client.js';

export interface MeInterface {
  id: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

const meKey = ['me'] as const;

/** Who is signed in: null for nobody. */
export function useMe(): UseQueryResult<MeInterface | null> {
  return useQuery({
    queryKey: meKey,
    queryFn: async (): Promise<MeInterface | null> => {
      const result = await api.GET('/auth/me');
      // Nobody signed in is an answer, not a failure.
      if (result.response.status === 401) return null;

      return ensure(result)?.user ?? null;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin(): UseMutationResult<void, Error, { email: string; password: string }> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<void> => {
      ensure(await api.POST('/auth/login', { body: credentials }));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: meKey }),
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      ensure(await api.POST('/auth/logout'));
    },
    // What was read with the session is not for whoever comes next.
    onSuccess: (): void => {
      client.clear();
    },
  });
}

/** Proves the email with the token of the link of the mail; the user it is for has to be signed in. */
export function useVerifyEmail(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (token: string): Promise<void> => {
      ensure(await api.GET('/auth/verify-email', { params: { query: { token } } }));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: meKey }),
  });
}

export function useRegister(): UseMutationResult<void, Error, { email: string; password: string }> {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<void> => {
      ensure(await api.POST('/auth/register', { body: credentials }));
    },
  });
}

export function useResendVerification(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      ensure(await api.POST('/auth/verify-email/resend'));
    },
  });
}

export type OauthProviderType = 'google' | 'github';

function isOauthProvider(value: string): value is OauthProviderType {
  return value === 'google' || value === 'github';
}

/** The providers the hub has set up; none while they are not known, or when the hub does not say. */
export function useOauthProviders(): UseQueryResult<OauthProviderType[]> {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: async (): Promise<OauthProviderType[]> =>
      (ensure(await api.GET('/auth/oauth/providers'))?.providers ?? []).filter(isOauthProvider),
    staleTime: 5 * 60_000,
  });
}
