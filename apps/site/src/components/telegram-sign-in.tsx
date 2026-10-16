'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signInWithTelegram, useTelegramApp } from '@/components/telegram-mini-app';
import { authClient } from '@/lib/auth-client';
import type { TelegramLoginPollResult, TelegramLoginStartResult } from '@/lib/telegram-auth';
import { setTelegramAppState } from '@/lib/telegram-web-app';

const POLL_INTERVAL_MS = 2_000;
const LOGIN_TTL_MS = 5 * 60 * 1_000;

type Waiting = { token: string; url: string; startedAt: number };

function TelegramIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.95 4.6 18.8 19.5c-.24 1.06-.86 1.32-1.75.82l-4.83-3.56-2.33 2.24c-.26.26-.47.47-.97.47l.35-4.9 8.93-8.07c.39-.35-.08-.54-.6-.19L6.56 13.25l-4.75-1.49c-1.03-.32-1.05-1.03.22-1.53l18.55-7.15c.86-.32 1.61.19 1.37 1.52Z" />
    </svg>
  );
}

/**
 * «Войти через Telegram». Inside the Mini App it signs in with the launch data;
 * in a browser it opens the bot, which asks the member to confirm, and waits for that confirmation.
 */
export function TelegramSignIn() {
  const router = useRouter();
  const { webApp, auth } = useTelegramApp();
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [error, setError] = useState<string>();
  const cancelled = useRef(false);

  function finish() {
    setTelegramAppState({ auth: 'signed-in' });
    router.push('/profile');
    router.refresh();
  }

  useEffect(() => {
    if (!waiting) return;
    cancelled.current = false;
    let timer: number | undefined;
    const poll = async () => {
      if (cancelled.current) return;
      if (Date.now() - waiting.startedAt > LOGIN_TTL_MS) {
        setWaiting(null);
        setError('Время на подтверждение вышло. Попробуйте ещё раз.');
        return;
      }
      const { data, error: requestError } = await authClient.$fetch<TelegramLoginPollResult>('/telegram/login/poll', {
        method: 'POST',
        body: { token: waiting.token },
      });
      if (cancelled.current) return;
      if (requestError || !data || data.status === 'expired') {
        setWaiting(null);
        setError(requestError?.message || 'Время на подтверждение вышло. Попробуйте ещё раз.');
        return;
      }
      if (data.status === 'rejected') {
        setWaiting(null);
        setError('Вход отменён в Telegram.');
        return;
      }
      if (data.status === 'signed-in') {
        finish();
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled.current = true;
      window.clearTimeout(timer);
    };
    // finish() only touches stable router/store references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(undefined);

    if (webApp) {
      const result = await signInWithTelegram(webApp, true);
      if (result.status === 'signed-in') return finish();
      setError(result.status === 'error' ? result.message : 'Не удалось войти через Telegram.');
      setPending(false);
      return;
    }

    // Open the tab during the click, otherwise browsers block it as a popup.
    const tab = window.open('', '_blank');
    const { data, error: requestError } = await authClient.$fetch<TelegramLoginStartResult>('/telegram/login/start', { method: 'POST', body: {} });
    setPending(false);
    if (requestError || !data) {
      tab?.close();
      setError(requestError?.message || 'Не удалось начать вход через Telegram.');
      return;
    }
    if (tab) tab.location.href = data.url;
    setWaiting({ token: data.token, url: data.url, startedAt: Date.now() });
  }

  if (waiting) {
    return (
      <section className="telegram-sign-in telegram-sign-in-waiting" aria-live="polite">
        <span className="telegram-sign-in-spinner" aria-hidden="true" />
        <p><strong>Подтвердите вход в Telegram</strong></p>
        <p className="field-help">Нажмите «Подтвердить вход» в сообщении от бота CanRush. Эта страница войдёт сама.</p>
        <a className="telegram-button" href={waiting.url} target="_blank" rel="noopener noreferrer"><TelegramIcon />Открыть Telegram</a>
        <button className="telegram-sign-in-cancel" type="button" onClick={() => setWaiting(null)}>Отмена</button>
      </section>
    );
  }

  const busy = pending || auth === 'signing-in';
  return (
    <div className="telegram-sign-in">
      <button className="telegram-button" type="button" onClick={handleClick} disabled={busy}>
        <TelegramIcon />
        {busy ? 'Входим…' : 'Войти через Telegram'}
      </button>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
