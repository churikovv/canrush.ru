import '@/styles/shared.css';
import '@/styles/profile.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrinkCalendarScreen } from '@/components/drink-calendar-screen';
import { auth } from '@/lib/auth';
import { ensureOwnProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Трекер выпитого', robots: { index: false, follow: false } };

/**
 * The tab bar's «Трекер»: the member's own drink tracker, rendered here rather than redirected to
 * /profile/<username>/calendar, so it opens in one request. It has no «В профиль»: the tab bar is the way back.
 */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const [profile, { month }] = await Promise.all([ensureOwnProfile(session.user), searchParams]);
  return <DrinkCalendarScreen username={profile.username} requested={month} tab />;
}
