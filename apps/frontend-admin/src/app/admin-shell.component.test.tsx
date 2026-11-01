import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { AdminShell } from './admin-shell.component.js';

test('the title of the panel is followed by the version of the release', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> =>
      Promise.resolve(Response.json({ message: 'no' }, { status: 401 })),
    ),
  );
  const router = createMemoryRouter([{ path: '/', element: <AdminShell /> }]);
  render(
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );

  const title = screen.getByRole('heading', { level: 4 });
  expect(title).toHaveTextContent('Hub admin');
  expect(title.nextElementSibling).toHaveTextContent(`v${APP_VERSION}`);
  expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
