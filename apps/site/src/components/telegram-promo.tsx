import Image from 'next/image';

export const TELEGRAM_CHANNEL_URL = 'https://t.me/canrushoff';

export function TelegramPromo() {
  return <section className="telegram-promo" aria-labelledby="telegram-promo-title">
    <div className="telegram-promo-copy">
      <span className="telegram-promo-kicker"><Image src="/brand/icons/telegram.svg" width={20} height={20} alt="" />Telegram · @canrushoff</span>
      <h2 id="telegram-promo-title">CanRush в Telegram</h2>
      <p>Подписывайтесь на канал, чтобы не пропускать новости проекта.</p>
    </div>
    <a className="telegram-promo-button" href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer" aria-label="Подписаться на Telegram-канал CanRush (откроется в новой вкладке)">Подписаться</a>
  </section>;
}
