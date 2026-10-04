'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getPool } from '@/db/pool';
import { NOTIFICATION_OPTIONS } from '@/lib/notification-preferences';

export async function saveNotificationSettings(form: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  await getPool().query(`insert into "notificationPreference" ("userId",kind,enabled)
    select $1, unnest($2::text[]), unnest($3::boolean[])
    on conflict ("userId",kind) do update set enabled=excluded.enabled`,
    [session.user.id, NOTIFICATION_OPTIONS.map(x => x.kind), NOTIFICATION_OPTIONS.map(x => form.get(x.kind) === 'on')]);
  redirect('/profile/settings?saved=1');
}
