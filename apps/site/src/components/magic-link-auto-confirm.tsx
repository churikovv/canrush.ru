'use client';

import { useEffect, useRef } from 'react';
import { confirmMagicLink } from '@/app/auth/confirm/actions';

export function MagicLinkAutoConfirm({ token }: { token: string }) {
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
      <noscript>
        <p>Для автоматического входа включите JavaScript или нажмите кнопку.</p>
        <button className="primary-button" type="submit">Войти в CanRush</button>
      </noscript>
    </form>
  );
}
