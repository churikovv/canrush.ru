'use server';
import { headers } from 'next/headers';
import { getPool } from '@/db/pool';
import { auth } from '@/lib/auth';
import { registerPushDevice, unregisterPushDevice } from '@/lib/push/outbox';

const TOKEN = /^[A-Za-z0-9:_\-.]{16,4096}$/u;

/** Called by the Android app with its FCM/RuStore token; the member comes from the session, never from the client. */
export async function registerPushDeviceAction(token: string, provider: string): Promise<{ ok: boolean }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || typeof token !== 'string' || !TOKEN.test(token) || (provider !== 'fcm' && provider !== 'rustore')) return { ok: false };
  await registerPushDevice(getPool(), session.user.id, token, provider);
  return { ok: true };
}

/** Before signing out: this device stops receiving the member's pushes. */
export async function unregisterPushDeviceAction(token: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || typeof token !== 'string' || !TOKEN.test(token)) return;
  await unregisterPushDevice(getPool(), session.user.id, token);
}
