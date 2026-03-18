/**
 * Vitest Setup File
 *
 * Global mocks and setup for component testing
 * Provides mocks for browser APIs not available in happy-dom
 */
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================
// Browser API Mocks
// ============================================================

/**
 * Mock ResizeObserver
 * Required for components that observe element size changes
 */
class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element): void {
    // Simulate immediate callback with empty entries
  }

  unobserve(_target: Element): void {
    // No-op
  }

  disconnect(): void {
    // No-op
  }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

/**
 * Mock PointerCapture APIs
 * Required for Radix UI Select and other pointer-based components
 */
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

/**
 * Mock IntersectionObserver
 * Required for lazy loading and visibility detection
 */
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element): void {
    // No-op
  }

  unobserve(_target: Element): void {
    // No-op
  }

  disconnect(): void {
    // No-op
  }

  get root(): Element | null {
    return null;
  }

  get rootMargin(): string {
    return '';
  }

  get thresholds(): ReadonlyArray<number> {
    return [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

/**
 * Mock matchMedia
 * Required for responsive components and dark mode detection
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * Mock window.scrollTo
 * Prevents errors from scroll operations in tests
 */
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

/**
 * Mock Element.prototype.scrollIntoView
 * Required for components that scroll elements into view
 */
Element.prototype.scrollIntoView = vi.fn();

/**
 * Mock fetch API
 * Default mock that can be overridden in individual tests
 */
globalThis.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  })
);

/**
 * Mock console.error to track error calls
 * Useful for testing error handling without polluting test output
 */
const originalConsoleError = console.error;
console.error = vi.fn((...args: unknown[]) => {
  // Filter out React act() warnings in tests
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('Warning: An update to')
  ) {
    return;
  }
  originalConsoleError(...args);
});

/**
 * Mock console.warn to track warning calls
 */
const originalConsoleWarn = console.warn;
console.warn = vi.fn((...args: unknown[]) => {
  originalConsoleWarn(...args);
});

// ============================================================
// Custom Matchers Type Declarations
// ============================================================

// Note: jest-dom matchers are automatically typed via @testing-library/jest-dom
// which extends vitest's Assertion interface

// ============================================================
// Test Utilities
// ============================================================

/**
 * Wait for a specified amount of time
 * Useful for testing debounced/throttled operations
 */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock function that tracks calls and can be awaited
 */
export const createAsyncMock = <T>(
  resolveValue?: T
): ReturnType<typeof vi.fn> & { calls: unknown[][] } => {
  const mock = vi.fn().mockResolvedValue(resolveValue);
  return Object.assign(mock, { calls: mock.mock.calls });
};

/**
 * Suppress console errors for a specific test
 * Useful when testing error boundaries
 */
export const suppressConsoleError = (): (() => void) => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return () => spy.mockRestore();
};

/**
 * Generate random test data
 */
export const generateTestId = (): string =>
  `test-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================
// Global Type Augmentations
// ============================================================

declare global {
  // Extend Window interface for test mocks
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

export {};
