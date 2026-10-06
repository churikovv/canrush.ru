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
      'test/market.integration.test.ts',
      'test/profile-reports.integration.test.ts', 'test/burn-alias-migration.integration.test.ts', 'test/vulkan-alias-migration.integration.test.ts',
      'test/notifications.integration.test.ts', 'test/review-discussions.integration.test.ts', 'test/review-rating-migration.integration.test.ts', 'test/admin-dashboard.integration.test.ts',
      'test/profile-experience.integration.test.ts',
      'test/profile-customization.integration.test.ts',
      'test/profile-community.integration.test.ts',
      'test/review-photos.integration.test.ts',
      'test/auth.integration.test.ts',
      'test/admin.integration.test.ts',
      'node_modules/**',
      '.next/**',
    ],
  },
});
