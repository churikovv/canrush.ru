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
    include: ['test/profile-experience.integration.test.ts', 'test/profile-customization.integration.test.ts', 'test/profile-community.integration.test.ts', 'test/review-photos.integration.test.ts', 'test/auth.integration.test.ts', 'test/admin.integration.test.ts'],
    maxWorkers: 1,
  },
});
