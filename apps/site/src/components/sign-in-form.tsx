'use client';

import { useId, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

type FormState = 'idle' | 'sending' | 'sent';

/**
 * Email sign-in by magic link. `callbackURL` is one of the site's fixed pages (never from the address bar);
 * `allow` runs before sending — the sign-in page uses it for the consent checkbox.
 */
export function SignInForm({ callbackURL = '/profile', allow }: { callbackURL?: '/profile' | '/business/cabinet'; allow?: () => boolean }) {
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formState === 'sending' || (allow && !allow())) return;

    setError(undefined);
    setFormState('sending');
    const result = await authClient.signIn.magicLink({
      email,
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: '/auth/error',
    });

    if (result.error) {
      setError(
        result.error.status === 429
          ? 'Слишком много запросов для этого адреса. Попробуйте через 15 минут.'
          : 'Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.',
      );
      setFormState('idle');
      return;
    }

    setFormState('sent');
  }

  if (formState === 'sent') {
    return (
      <section className="auth-status" aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <h2>Письмо отправлено</h2>
        <p>Перейдите по ссылке из письма CanRush — {callbackURL === '/business/cabinet' ? 'кабинет для бизнеса' : 'профиль'} откроется автоматически. Ссылка действует 15 минут.</p>
        <button className="secondary-button" type="button" onClick={() => setFormState('idle')}>
          Отправить ссылку ещё раз
        </button>
      </section>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field-group sign-in-field">
        <label htmlFor={emailId} className="sr-only">Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          placeholder="Почта"
          disabled={formState === 'sending'}
        />
        {email && formState !== 'sending' ? <button className="sign-in-clear" type="button" aria-label="Очистить почту" onClick={() => { setEmail(''); setError(undefined); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button> : null}
        {error ? (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button className="primary-button sign-in-email-button" type="submit" disabled={formState === 'sending'}>
        {formState === 'sending' ? 'Отправляем…' : 'Получить ссылку'}
      </button>
    </form>
  );
}
