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
}
