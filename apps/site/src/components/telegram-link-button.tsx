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
    <button className="community-button" type="button" onClick={handleClick} disabled={pending}>{pending ? 'Открываем Telegram…' : 'Привязать Telegram'}</button>
    {error && <p className="field-error" role="alert">{error}</p>}
  </>;
}
