import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { createI18n } from './i18n/i18n.js';

// The tests read the interface in English, whatever the language of the machine they run on.
createI18n('en');

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

// Nor does it measure elements: Mantine's segmented controls ask to be told when theirs change.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {
      return undefined;
    }
    unobserve(): void {
      return undefined;
    }
    disconnect(): void {
      return undefined;
    }
  },
);

afterEach((): void => {
  cleanup();
});
