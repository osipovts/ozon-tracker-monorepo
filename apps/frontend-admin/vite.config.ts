import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Where the hub runs in development: the panel talks to it through this server, as from the same origin. */
const hub = process.env['HUB_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  // The hub serves the built panel under this path.
  base: '/panel/',
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/auth', '/admin', '/proxies', '/proxy-sources', '/jobs'].map((path): [string, object] => [
        path,
        // The hub checks where a write comes from: the panel in development says it is the hub itself.
        { target: hub, headers: { origin: hub } },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    restoreMocks: true,
  },
});
