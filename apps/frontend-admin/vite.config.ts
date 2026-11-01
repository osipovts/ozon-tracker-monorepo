import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import rootPackage from '../../package.json' with { type: 'json' };

/** Where the hub runs in development: the panel talks to it through this server, as from the same origin. */
const hub = process.env['HUB_URL'] ?? 'http://localhost:3000';
/** The origin the hub knows itself by (its PUBLIC_URL): in Docker the address it is reached at differs. */
const hubOrigin = process.env['HUB_ORIGIN'] ?? hub;

export default defineConfig({
  plugins: [react()],
  // The version of the release, which the root package.json holds: the page shows it.
  define: { __APP_VERSION__: JSON.stringify(rootPackage.version) },
  // The hub serves the built panel under this path.
  base: '/panel/',
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/auth', '/admin', '/proxies', '/proxy-sources', '/jobs', '/handbooks'].map(
        (path): [string, object] => [
          path,
          // The hub checks where a write comes from: the panel in development says it is the hub itself.
          { target: hub, headers: { origin: hubOrigin } },
        ],
      ),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    restoreMocks: true,
  },
});
