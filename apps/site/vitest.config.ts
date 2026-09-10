import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    exclude: [
      'test/auth.integration.test.ts',
      'test/admin.integration.test.ts',
      'node_modules/**',
      '.next/**',
    ],
  },
});
