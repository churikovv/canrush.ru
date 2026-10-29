/** Bot delivery switches shared by the website settings page and the bot's /settings keyboard. */
export const TELEGRAM_BOT_OPTIONS = [
  { column: 'notify', code: 'n', label: 'Уведомления сайта', hint: 'Ответы, упоминания, подписки — как выбрано в «Уведомлениях»', adminOnly: false },
  { column: 'market', code: 'm', label: 'Маркет: заказы и сообщения', hint: 'Новые заказы, их статусы и сообщения', adminOnly: false },
  { column: 'promoAlerts', code: 'p', label: 'Акции на избранное', hint: 'Утром — скидки на напитки из избранного', adminOnly: false },
  { column: 'weeklyDigest', code: 'd', label: 'Подборка акций недели', hint: 'Скидки вашего города по понедельникам', adminOnly: false },
  { column: 'adminSummary', code: 'a', label: 'Сводка для админа', hint: 'Итоги суток: участники, отзывы, заказы — в 9:00', adminOnly: true },
] as const;
export type TelegramBotColumn = (typeof TELEGRAM_BOT_OPTIONS)[number]['column'];
