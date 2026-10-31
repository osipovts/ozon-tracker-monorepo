import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no media queries, and Mantine asks for the color scheme of the system.
vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: (): void => undefined,
  removeEventListener: (): void => undefined,
  addListener: (): void => undefined,
  removeListener: (): void => undefined,
  dispatchEvent: (): boolean => false,
}));

afterEach((): void => {
  cleanup();
});
