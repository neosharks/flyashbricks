import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no layout and no media queries; forms scroll errors into view
// and check for reduced motion.
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = () => undefined;
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
