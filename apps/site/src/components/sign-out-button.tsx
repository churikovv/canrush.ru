'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signOut() {
    setPending(true);
    setError(undefined);
    const result = await authClient.signOut();
    if (result.error) {
      setError('Не удалось завершить сессию. Попробуйте ещё раз.');
      setPending(false);
      return;
    }
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <div className="sign-out-control">
      <button className="primary-button" type="button" onClick={signOut} disabled={pending}>
        {pending ? 'Выходим…' : 'Выйти из аккаунта'}
      </button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
