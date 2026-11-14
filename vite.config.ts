import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build can be hosted from any sub-path (GitHub Pages).
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
