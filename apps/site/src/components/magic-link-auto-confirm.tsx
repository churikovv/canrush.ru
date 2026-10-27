'use client';

import { useEffect, useRef } from 'react';
import { confirmMagicLink } from '@/app/auth/confirm/actions';

export function MagicLinkAutoConfirm({ token, business = false }: { token: string; business?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current || !form.current) return;
    submitted.current = true;
    form.current.requestSubmit();
  }, []);

  return (
    <form ref={form} action={confirmMagicLink}>
      <input type="hidden" name="token" value={token} />
      {business ? <input type="hidden" name="for" value="business" /> : null}
      <noscript>
        <p>Для автоматического входа включите JavaScript или нажмите кнопку.</p>
        <button className="primary-button" type="submit">Войти в CanRush</button>
      </noscript>
    </form>
  );
}
