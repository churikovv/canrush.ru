'use client';

import { useId, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';

type FormState = 'idle' | 'sending' | 'sent';

const CODE_LENGTH = 6;
/** What went wrong with a code, by the auth error's code; anything else is a plain retry. */
const CODE_ERRORS: Record<string, string> = {
  INVALID_OTP: 'Код не подошёл. Проверьте цифры в последнем письме.',
  OTP_EXPIRED: 'Код устарел. Отправьте письмо ещё раз — придёт новый.',
  TOO_MANY_ATTEMPTS: 'Слишком много попыток. Отправьте письмо ещё раз — придёт новый код.',
};

/**
 * Email sign-in: one letter with a link and a six-digit code. The link signs in where it opens — often a mail app's own
 * browser — so the page that asked for the letter also takes the code. `callbackURL` is one of the site's fixed pages
 * (never from the address bar); `allow` runs before sending — the sign-in page uses it for the consent checkbox.
 */
export function SignInForm({ callbackURL = '/profile', allow }: { callbackURL?: '/profile' | '/business/cabinet'; allow?: () => boolean }) {
  const emailId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string>();
  const codeId = useId();
  const codeErrorId = useId();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [verifying, setVerifying] = useState(false);

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

    setCode('');
    setCodeError(undefined);
    setFormState('sent');
  }

  async function signInWithCode(value: string) {
    if (verifying || value.length !== CODE_LENGTH) return;
    setCodeError(undefined);
    setVerifying(true);
    const result = await authClient.signIn.emailOtp({ email, otp: value });
    if (result.error) {
      setCodeError(result.error.status === 429 ? 'Слишком много попыток с этого устройства. Подождите минуту.'
        : CODE_ERRORS[result.error.code ?? ''] ?? 'Не удалось войти по коду. Попробуйте ещё раз.');
      setVerifying(false);
      return;
    }
    // A full load, so the header and every server page see the new session cookie.
    window.location.assign(callbackURL);
  }

  function typeCode(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setCodeError(undefined);
    // Six digits are the whole code (often pasted or filled from the letter): no need to press the button.
    if (digits.length === CODE_LENGTH) void signInWithCode(digits);
  }

  if (formState === 'sent') {
    return (
      <div className="sign-in-sent">
        <section className="auth-status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <h2>Письмо отправлено</h2>
          <p>Мы написали на {email}. Нажмите ссылку в письме — {callbackURL === '/business/cabinet' ? 'кабинет для бизнеса' : 'профиль'} откроется сам. Ссылка и код действуют 15 минут.</p>
        </section>
        <form className="auth-form sign-in-code" onSubmit={(event) => { event.preventDefault(); void signInWithCode(code); }}>
          <div className="field-group">
            <label htmlFor={codeId} className="sign-in-code-label">Ссылка открылась в другом браузере? Введите код из письма</label>
            <input
              id={codeId}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              value={code}
              onChange={(event) => typeCode(event.target.value)}
              aria-describedby={codeError ? codeErrorId : undefined}
              aria-invalid={Boolean(codeError)}
              placeholder="000000"
              disabled={verifying}
            />
            {codeError ? <p id={codeErrorId} className="field-error" role="alert">{codeError}</p> : null}
          </div>
          <button className="primary-button sign-in-email-button" type="submit" disabled={verifying || code.length !== CODE_LENGTH}>
            {verifying ? 'Входим…' : 'Войти по коду'}
          </button>
        </form>
        <button className="secondary-button sign-in-resend" type="button" onClick={() => setFormState('idle')}>
          Отправить письмо ещё раз
        </button>
      </div>
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
