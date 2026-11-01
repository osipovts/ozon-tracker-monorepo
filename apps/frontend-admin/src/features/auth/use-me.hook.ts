import { createAuthHooks, ensure, type MeInterface } from 'frontend-shared';

import { api } from '../../shared/api/api.client.js';

export type { MeInterface };

export const { useLogin, useLogout, useMe } = createAuthHooks({
  me: async (): Promise<MeInterface | null> => {
    const result = await api.GET('/auth/me');
    // Nobody signed in is an answer, not a failure.
    if (result.response.status === 401) return null;

    return ensure(result)?.user ?? null;
  },
  logIn: async (credentials): Promise<void> => {
    ensure(await api.POST('/auth/login', { body: credentials }));
  },
  logOut: async (): Promise<void> => {
    ensure(await api.POST('/auth/logout'));
  },
});
