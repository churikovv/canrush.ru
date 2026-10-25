import '@/styles/shared.css';
import '@/styles/profile.css';
import { DrinkCalendarScreen } from '@/components/drink-calendar-screen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Календарь выпитого', robots: { index: false, follow: false } };

export default async function DrinkCalendarPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ username }, { month }] = await Promise.all([params, searchParams]);
  return <DrinkCalendarScreen username={username} requested={month} />;
}
