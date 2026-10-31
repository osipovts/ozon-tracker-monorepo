import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { createAppRouter } from './app/router.js';
import { createI18n } from './i18n/i18n.js';

createI18n();
const queryClient = new QueryClient();
const container = document.getElementById('root');
if (container === null) throw new Error('The page has no #root');

createRoot(container).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={createAppRouter(import.meta.env.BASE_URL.replace(/\/$/, ''))} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
