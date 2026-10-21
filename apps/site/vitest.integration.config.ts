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
    include: ['test/drink-calendar.integration.test.ts', 'test/rank-up.integration.test.ts', 'test/brand-collection.integration.test.ts', 'test/archived-duplicate-alias-migration.integration.test.ts', 'test/telegram-bot.integration.test.ts', 'test/telegram-auth.integration.test.ts', 'test/monthly-top.integration.test.ts', 'test/vulkan-fruit-alias-migration.integration.test.ts', 'test/pulse-alias-migration.integration.test.ts', 'test/gorilla-alias-migration.integration.test.ts', 'test/cosmos-alias-migration.integration.test.ts', 'test/flash-alias-migration.integration.test.ts', 'test/adrenaline-alias-migration.integration.test.ts', 'test/imported-alias-migration.integration.test.ts', 'test/reviewed-alias-migration.integration.test.ts', 'test/profile-compatibility-history.integration.test.ts', 'test/stores.integration.test.ts', 'test/contest.integration.test.ts', 'test/beta-engine.integration.test.ts', 'test/mentions.integration.test.ts', 'test/comment-media.integration.test.ts', 'test/store-transfer.integration.test.ts', 'test/wall-discussions.integration.test.ts', 'test/tier-discussions.integration.test.ts', 'test/favorite-removal.integration.test.ts', 'test/tier-sections.integration.test.ts', 'test/campaigns.integration.test.ts', 'test/market.integration.test.ts', 'test/profile-reports.integration.test.ts', 'test/burn-alias-migration.integration.test.ts', 'test/vulkan-alias-migration.integration.test.ts', 'test/volt-alias-migration.integration.test.ts', 'test/monster-alias-migration.integration.test.ts', 'test/notifications.integration.test.ts', 'test/review-discussions.integration.test.ts', 'test/review-rating-migration.integration.test.ts', 'test/admin-dashboard.integration.test.ts', 'test/profile-experience.integration.test.ts', 'test/profile-customization.integration.test.ts', 'test/profile-community.integration.test.ts', 'test/review-photos.integration.test.ts', 'test/auth.integration.test.ts', 'test/admin.integration.test.ts'],
    maxWorkers: 1,
  },
});
