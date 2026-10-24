'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { unregisterPushDeviceAction } from '@/app/notifications/push-actions';
import { authClient } from '@/lib/auth-client';
import { storedPushToken, storePushToken } from '@/lib/native-app';

/** Signs out: unregisters this device's push token first (it needs the session), then goes to the sign-in page. */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signOut() {
    setPending(true);
    setError(undefined);
    // In the app: this device stops getting the member's pushes. Must run while the session still exists.
    const pushToken = storedPushToken();
    if (pushToken) {
      await unregisterPushDeviceAction(pushToken).catch(() => {});
      storePushToken(null);
    }
    const result = await authClient.signOut();
    if (result.error) {
      setError('Не удалось завершить сессию. Попробуйте ещё раз.');
      setPending(false);
      return;
    }
    router.replace('/sign-in');
    router.refresh();
  }

  return { signOut, pending, error };
}
