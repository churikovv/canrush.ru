import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/** The tab bar's «Календарь»: the member's own drink calendar, where today's can is one tap away. */
export default async function CalendarRedirect() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const profile = await ensureOwnProfile(session.user);
  redirect(`/profile/${profile.username}/calendar`);
}
