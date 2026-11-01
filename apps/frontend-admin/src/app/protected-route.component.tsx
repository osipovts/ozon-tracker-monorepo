import { Center, Loader } from '@mantine/core';
import { ErrorAlert } from 'frontend-shared';
import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';

import { useMe } from '../features/auth/use-me.hook.js';
import { AccessDenied } from './access-denied.component.js';

/** Lets in the administrators only: the others are sent to log in, or told the panel is not theirs. */
export function ProtectedRoute(): ReactElement {
  const me = useMe();

  if (me.isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (me.isError) return <ErrorAlert error={me.error} />;
  if (me.data === null) return <Navigate to="/login" replace />;
  if (!me.data.isAdmin) return <AccessDenied email={me.data.email} />;

  return <Outlet />;
}
