import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

export interface MeInterface {
  id: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

export interface CredentialsInterface {
  email: string;
  password: string;
}

/** What the hooks ask of the hub, in the calls of the client of the app, which knows its paths. */
export interface AuthApiInterface {
  /** Who is signed in; null for nobody, which is an answer, not a failure. */
  me: () => Promise<MeInterface | null>;
  logIn: (credentials: CredentialsInterface) => Promise<void>;
  logOut: () => Promise<void>;
}

/** The key of the signed-in user among the queries. */
export const meQueryKey = ['me'] as const;

export interface AuthHooksInterface {
  useMe: () => UseQueryResult<MeInterface | null>;
  useLogin: () => UseMutationResult<void, Error, CredentialsInterface>;
  useLogout: () => UseMutationResult<void, Error, void>;
}

/** The hooks of the session of the user, for an app that tells them how to reach the hub. */
export function createAuthHooks(api: AuthApiInterface): AuthHooksInterface {
  return {
    useMe: (): UseQueryResult<MeInterface | null> =>
      useQuery({
        queryKey: meQueryKey,
        queryFn: api.me,
        retry: false,
        staleTime: 60_000,
      }),

    useLogin: (): UseMutationResult<void, Error, CredentialsInterface> => {
      const client = useQueryClient();

      return useMutation({
        mutationFn: api.logIn,
        onSuccess: (): Promise<void> => client.invalidateQueries({ queryKey: meQueryKey }),
      });
    },

    useLogout: (): UseMutationResult<void, Error, void> => {
      const client = useQueryClient();

      return useMutation({
        mutationFn: api.logOut,
        // What was read with the session is not for whoever comes next.
        onSuccess: (): void => {
          client.clear();
        },
      });
    },
  };
}
