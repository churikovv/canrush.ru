export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.TELEGRAM_WORKER !== 'off') {
    const { startTelegramWorker } = await import('@/lib/telegram-bot/worker');
    startTelegramWorker();
  }
  if (process.env.PUSH_WORKER !== 'off') {
    const { startPushWorker } = await import('@/lib/push/worker');
    startPushWorker();
  }
  // Review summaries spend model tokens: production only, unless a developer opts in with DIGEST_WORKER=on.
  if (process.env.DIGEST_WORKER === 'on' || (process.env.NODE_ENV === 'production' && process.env.DIGEST_WORKER !== 'off')) {
    const { startReviewDigestWorker } = await import('@/lib/review-digest-worker');
    startReviewDigestWorker();
  }
  // The duplicate check of members' drinks spends model tokens too: production only, unless DRINK_CHECK_WORKER=on.
  if (process.env.DRINK_CHECK_WORKER === 'on' || (process.env.NODE_ENV === 'production' && process.env.DRINK_CHECK_WORKER !== 'off')) {
    const { startDrinkCheckWorker } = await import('@/lib/drink-check-worker');
    startDrinkCheckWorker();
  }
  // Letters to companies: production only, unless a developer opts in with BUSINESS_REPORT_WORKER=on.
  if (process.env.BUSINESS_REPORT_WORKER === 'on' || (process.env.NODE_ENV === 'production' && process.env.BUSINESS_REPORT_WORKER !== 'off')) {
    const { startBusinessReportWorker } = await import('@/lib/business-report-worker');
    startBusinessReportWorker();
  }
}
