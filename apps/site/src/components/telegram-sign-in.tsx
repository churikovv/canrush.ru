'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithTelegram, useTelegramApp } from '@/components/telegram-mini-app';
import { setTelegramAppState } from '@/lib/telegram-web-app';

/** Sign-in option shown only inside the Telegram Mini App for a Telegram account without a CanRush link. */
export function TelegramSignIn() {
  const router = useRouter();
  const { webApp, auth } = useTelegramApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  if (!webApp || auth === 'idle' || auth === 'signed-in') return null;

  async function handleClick() {
    if (!webApp || pending) return;
    setPending(true);
    setError(undefined);
    const result = await signInWithTelegram(webApp, true);
    if (result.status === 'signed-in') {
      setTelegramAppState({ auth: 'signed-in' });
      router.push('/profile');
      router.refresh();
      return;
    }
    setError(result.status === 'error' ? result.message : 'Не удалось войти через Telegram.');
    setPending(false);
  }

  return (
    <section className="telegram-sign-in" aria-labelledby="telegram-sign-in-title">
      <h2 id="telegram-sign-in-title">Вход через Telegram</h2>
      <p>Новый аккаунт CanRush создастся по вашему Telegram, почта не нужна.</p>
      <button className="primary-button" type="button" onClick={handleClick} disabled={pending || auth === 'signing-in'}>
        {pending || auth === 'signing-in' ? 'Входим…' : 'Продолжить с Telegram'}
      </button>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <p className="field-help">
        Уже есть аккаунт на сайте? Откройте canrush.ru → Настройки → «Привязать Telegram», чтобы входить в него отсюда.
      </p>
    </section>
  );
}
