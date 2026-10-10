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
    include: ['test/tier-discussions.integration.test.ts', 'test/favorite-removal.integration.test.ts', 'test/tier-sections.integration.test.ts', 'test/campaigns.integration.test.ts', 'test/market.integration.test.ts', 'test/profile-reports.integration.test.ts', 'test/burn-alias-migration.integration.test.ts', 'test/vulkan-alias-migration.integration.test.ts', 'test/volt-alias-migration.integration.test.ts', 'test/monster-alias-migration.integration.test.ts', 'test/notifications.integration.test.ts', 'test/review-discussions.integration.test.ts', 'test/review-rating-migration.integration.test.ts', 'test/admin-dashboard.integration.test.ts', 'test/profile-experience.integration.test.ts', 'test/profile-customization.integration.test.ts', 'test/profile-community.integration.test.ts', 'test/review-photos.integration.test.ts', 'test/auth.integration.test.ts', 'test/admin.integration.test.ts'],
    maxWorkers: 1,
  },
});
