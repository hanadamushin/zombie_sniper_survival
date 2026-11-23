import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build can be hosted from any sub-path (GitHub Pages).
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Heavy headless runs (a 300 s raid, all 4,108 area files) take 1-4 s alone and went past the 5 s
    // default under the parallel suite now and then. Speed budgets are asserted inside the tests.
    testTimeout: 30_000,
  },
});
