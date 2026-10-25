'use client';

import { useState } from 'react';
import { createTelegramLink } from '@/app/profile/settings/actions';

export function TelegramLinkButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function handleClick() {
    setPending(true);
    setError(undefined);
    const result = await createTelegramLink();
    if ('url' in result) {
      window.location.href = result.url;
      return;
    }
    setError(result.error);
    setPending(false);
  }

  return <>
    <button className="community-button tg-settings-link" type="button" onClick={handleClick} disabled={pending}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.7 3.3a1.6 1.6 0 0 0-1.7-.2L2.9 9.6c-1.2.5-1.1 2.2.1 2.6l3.9 1.2 1.5 4.8c.3.9 1.4 1.2 2.1.5l2.2-2.1 4.1 3c.9.7 2.2.2 2.4-.9l2.6-13.9c.1-.6-.1-1.2-.6-1.5ZM10 14.2l-.6 3.2-1.1-3.6 9.4-7.5-7.7 7.9Z" /></svg>
      {pending ? 'Открываем Telegram…' : 'Привязать Telegram'}
    </button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </>;
}

/** «Отвязать Telegram» with a confirmation: the mini app stops opening this account, the bot stops writing. */
export function TelegramUnlinkButton({ action }: { action: () => Promise<void> }) {
  return <form action={action}>
    <button className="community-button community-button-secondary tg-settings-unlink" type="submit"
      onClick={event => { if (!window.confirm('Отвязать Telegram? Мини-приложение перестанет открывать этот аккаунт, а бот — присылать уведомления. Привязать снова можно в любой момент.')) event.preventDefault(); }}>
      Отвязать Telegram
    </button>
  </form>;
}
