export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.TELEGRAM_WORKER === 'off') return;
  const { startTelegramWorker } = await import('@/lib/telegram-bot/worker');
  startTelegramWorker();
}
