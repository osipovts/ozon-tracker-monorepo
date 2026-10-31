import { createBrowserRouter } from 'react-router';

import { LoginPage } from '../features/auth/login.page.js';
import { DashboardPage } from '../features/dashboard/dashboard.page.js';
import { ProxiesPage } from '../features/proxies/proxies.page.js';
import { AdminShell } from './app-shell.component.js';
import { ProtectedRoute } from './protected-route.component.js';

export function createAppRouter(basename: string): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AdminShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'proxies', element: <ProxiesPage /> },
            ],
          },
        ],
      },
    ],
    { basename },
  );
}
