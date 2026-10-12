import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // See tests/server-only-stub.ts for why this is safe.
      'server-only': fileURLToPath(new URL('./tests/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    // The minimum public values modules need to import the validated environment.
    env: {
      NODE_ENV: 'test',
      SKIP_ENV_VALIDATION: 'true',
      LOG_LEVEL: 'silent',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_NAME: 'Fly Ash Bricks',
      MONGOMS_VERSION: '8.2.1',
    },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    sequence: { shuffle: true },
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['features/**', 'lib/**', 'models/**'],
      exclude: ['**/*.test.*', '**/components/**'],
    },
  },
});
