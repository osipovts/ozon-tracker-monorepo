import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ensure } from '../../shared/api/api.client.js';

export interface MeInterface {
  id: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

const meKey = ['me'] as const;

/** Who is signed in: null for nobody. */
export function useMe(): ReturnType<typeof useQuery<MeInterface | null>> {
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

export function useLogin(): ReturnType<
  typeof useMutation<void, Error, { email: string; password: string }>
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<void> => {
      ensure(await api.POST('/auth/login', { body: credentials }));
    },
    onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: meKey }),
  });
}

export function useLogout(): ReturnType<typeof useMutation<void, Error, void>> {
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

export function useRegister(): ReturnType<
  typeof useMutation<void, Error, { email: string; password: string }>
> {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }): Promise<void> => {
      ensure(await api.POST('/auth/register', { body: credentials }));
    },
  });
}

export function useResendVerification(): ReturnType<typeof useMutation<void, Error, void>> {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      ensure(await api.POST('/auth/verify-email/resend'));
    },
  });
}
