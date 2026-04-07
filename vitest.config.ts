import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node', // Changed from 'jsdom' for server-side testing
    setupFiles: ['./vitest.setup.ts'], // Keep existing setup file
    include: [
      '**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}' // Added tests/ directory
    ],
    exclude: ['node_modules', 'build', '.react-router'],
    testTimeout: 60000, // 1 minute default timeout
    hookTimeout: 30000, // 30 seconds for setup/teardown
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'build/',
        '.react-router/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/coverage/**',
        'scripts/**',
        'auto/**',
        'tests/**' // Exclude test files from coverage
      ]
    }
  }
})