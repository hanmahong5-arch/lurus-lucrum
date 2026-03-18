/**
 * Vitest Configuration
 *
 * Configuration for component edge case testing with React Testing Library
 * Uses happy-dom for fast DOM simulation
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Use esbuild for JSX transformation (no plugin needed)
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    // Use happy-dom for fast DOM simulation
    environment: 'happy-dom',

    // Setup files for test environment
    setupFiles: ['./src/__tests__/setup.ts'],

    // Include test files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.next'],

    // Global test APIs (describe, it, expect, etc.)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        'src/__tests__/setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
        '.next/**',
      ],
      // Coverage thresholds for edge case testing
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 90,
        lines: 85,
      },
    },

    // Test timeout for stress tests
    testTimeout: 30000,

    // Reporter configuration
    reporters: ['verbose'],

    // Mock Date for consistent testing
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    },
  },

  // Resolve path aliases (match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
