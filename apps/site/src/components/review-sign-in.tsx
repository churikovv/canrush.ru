'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useSyncExternalStore, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import { isNativeApp } from '@/lib/native-app';
import type { ReviewSignInResult } from '@/lib/review-login';

const subscribeNever = () => () => {};

/**
 * Password sign-in for the review accounts: Google Play and RuStore reviewers (REVIEW_LOGIN_*) cannot open a magic link
 * or Telegram, and neither can the payment provider's reviewer (PAYMENT_REVIEW_*). Inside the apps it is folded under a
 * link; on the web it shows only on the direct link `/sign-in?review=1` (`web`), open at once, and leads to the plans.
 */
export function ReviewSignIn({ web = false }: { web?: boolean }) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  // The server cannot tell the app from a browser: render nothing there and decide on the client.
  const native = useSyncExternalStore(subscribeNever, isNativeApp, () => false);
  const available = web || native;
  const [open, setOpen] = useState(web);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  if (!available) return null;

  if (!open) {
    return <button className="telegram-sign-in-cancel review-sign-in-toggle" type="button" onClick={() => setOpen(true)}>Вход по паролю</button>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    const { data, error: requestError } = await authClient.$fetch<ReviewSignInResult>('/review/sign-in', {
      method: 'POST',
      body: { email, password },
    }).catch(() => ({ data: null, error: { status: 0, message: '' } }));
    if (data?.status === 'signed-in') {
      router.push(web ? '/business/cabinet?section=plan' : '/profile');
      router.refresh();
      return;
    }
    setPending(false);
    setError(requestError?.status === 429
      ? 'Слишком много попыток. Попробуйте через 15 минут.'
      : requestError?.message || 'Не удалось войти. Попробуйте ещё раз.');
  }

  return (
    <form className="auth-form review-sign-in" onSubmit={handleSubmit}>
      <p className="field-help">Вход по паролю — для проверки приложения и оплаты. Участники входят через Telegram или по почте.</p>
      <div className="field-group">
        <label htmlFor={emailId} className="sr-only">Email</label>
        <input id={emailId} name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
          required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" disabled={pending} />
        <label htmlFor={passwordId} className="sr-only">Пароль</label>
        <input id={passwordId} name="password" type="password" autoComplete="current-password" required maxLength={256}
          value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль" disabled={pending}
          aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} />
        {error ? <p id={errorId} className="field-error" role="alert">{error}</p> : null}
      </div>
      <button className="secondary-button sign-in-email-button" type="submit" disabled={pending}>{pending ? 'Входим…' : 'Войти'}</button>
    </form>
  );
}
