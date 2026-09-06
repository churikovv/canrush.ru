'use client';

import { useId, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

type FormState = 'idle' | 'sending' | 'sent';

export function SignInForm() {
  const emailId = useId();
  const helpId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formState === 'sending') return;

    setError(undefined);
    setFormState('sending');
    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: '/profile',
      newUserCallbackURL: '/profile',
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
        <p>Откройте письмо от CanRush и подтвердите вход. Ссылка действует 5 минут.</p>
        <button className="secondary-button" type="button" onClick={() => setFormState('idle')}>
          Отправить ссылку ещё раз
        </button>
      </section>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor={emailId}>Email</label>
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
          aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={Boolean(error)}
          placeholder="you@example.com"
          disabled={formState === 'sending'}
        />
        <p id={helpId} className="field-help">
          При первом входе аккаунт создастся автоматически.
        </p>
        {error ? (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button className="primary-button" type="submit" disabled={formState === 'sending'}>
        {formState === 'sending' ? 'Отправляем…' : 'Получить ссылку для входа'}
      </button>
      <p className="privacy-note">
        Email используется для входа и будущего избранного. Перед публичным запуском здесь появится
        ссылка на политику обработки данных.
      </p>
    </form>
  );
}
