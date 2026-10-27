'use client';

import { useRef, useState } from 'react';
import Link from '@/components/navigation-progress';
import { SignInForm } from '@/components/sign-in-form';
import { TelegramSignIn } from '@/components/telegram-sign-in';

export type SignInAudience = 'personal' | 'business';

const AUDIENCES: { value: SignInAudience; label: string; note: string }[] = [
  { value: 'personal', label: 'Для себя', note: 'Нет аккаунта? Создадим при первом входе.' },
  { value: 'business', label: 'Бизнес', note: 'Кабинет бренда или магазина. Войдите своим аккаунтом — компанию подключим к нему.' },
];

/**
 * The sign-in card: «Для себя / Бизнес» (business goes to the cabinet after signing in), email by magic link, then
 * Telegram, and the consent checkbox both of them need — unticked, it turns red and takes the focus instead.
 */
export function SignInPanel({ telegram, initial }: { telegram: boolean; initial: SignInAudience }) {
  const [audience, setAudience] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [missing, setMissing] = useState(false);
  const box = useRef<HTMLInputElement>(null);
  const callbackURL = audience === 'business' ? '/business/cabinet' : '/profile';
  const allow = () => {
    if (consent) return true;
    setMissing(true);
    box.current?.focus();
    return false;
  };
  return <>
    <header className="sign-in-head">
      <h1>Вход</h1>
      <p aria-live="polite">{AUDIENCES.find(item => item.value === audience)!.note}</p>
    </header>
    <div className="sign-in-audience" role="radiogroup" aria-label="Кто входит">
      {AUDIENCES.map(item => <button key={item.value} type="button" role="radio" aria-checked={audience === item.value}
        onClick={() => setAudience(item.value)}>{item.label}</button>)}
    </div>
    <div className="sign-in-email"><SignInForm callbackURL={callbackURL} allow={allow} /></div>
    {telegram ? <>
      <p className="sign-in-divider"><span>или</span></p>
      <TelegramSignIn callbackURL={callbackURL} allow={allow} />
    </> : null}
    <label className="sign-in-consent" data-missing={missing && !consent ? '' : undefined}>
      <input ref={box} type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setMissing(false); }} />
      <span>Принимаю <Link href="/terms">пользовательское соглашение</Link> и <Link href="/privacy">политику обработки персональных данных</Link></span>
    </label>
    {missing && !consent ? <p className="field-error sign-in-consent-error" role="alert">Отметьте согласие, чтобы войти.</p> : null}
  </>;
}
