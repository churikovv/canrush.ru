/** Bot delivery switches shared by the website settings page and the bot's /settings keyboard. */
export const TELEGRAM_BOT_OPTIONS = [
  { column: 'notify', code: 'n', label: 'Уведомления сайта', adminOnly: false },
  { column: 'market', code: 'm', label: 'Маркет: заказы и сообщения', adminOnly: false },
  { column: 'promoAlerts', code: 'p', label: 'Акции на избранное', adminOnly: false },
  { column: 'weeklyDigest', code: 'd', label: 'Подборка акций недели', adminOnly: false },
  { column: 'adminSummary', code: 'a', label: 'Сводка для админа', adminOnly: true },
] as const;
export type TelegramBotColumn = (typeof TELEGRAM_BOT_OPTIONS)[number]['column'];
