import { createBrowserRouter } from 'react-router';

import { LoginPage } from '../features/auth/login.page.js';
import { ProductPage } from '../features/products/product.page.js';
import { ProductsPage } from '../features/products/products.page.js';
import { SettingsPage } from '../features/settings/settings.page.js';
import { ClientShell } from './app-shell.component.js';
import { ProtectedRoute } from './protected-route.component.js';

export function createAppRouter(basename: string): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <ClientShell />,
            children: [
              { index: true, element: <ProductsPage /> },
              { path: 'products/:id', element: <ProductPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
    { basename },
  );
}
