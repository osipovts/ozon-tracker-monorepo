import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Where the hub runs in development: the app talks to it through this server, as from the same origin. */
const hub = process.env['HUB_URL'] ?? 'http://localhost:3000';
/** The origin the hub knows itself by (its PUBLIC_URL): in Docker the address it is reached at differs. */
const hubOrigin = process.env['HUB_ORIGIN'] ?? hub;

export default defineConfig({
  plugins: [react()],
  // The hub serves the built app under this path.
  base: '/app/',
  server: {
    port: 5174,
    proxy: Object.fromEntries(
      ['/auth', '/products'].map((path): [string, object] => [
        path,
        // The hub checks where a write comes from: the app in development says it is the hub itself.
        { target: hub, headers: { origin: hubOrigin } },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    restoreMocks: true,
  },
});
