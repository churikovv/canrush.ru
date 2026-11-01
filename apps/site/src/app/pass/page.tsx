import '@/styles/shared.css';
import '@/styles/pass.css';
import { headers } from 'next/headers';
import { SeasonPass } from '@/components/season-pass';
import { auth } from '@/lib/auth';
import { moscowDay } from '@/lib/drink-calendar-fields';
import { seasonDaysLeft } from '@/lib/season-fields';
import { getSeasonPass } from '@/lib/season-pass';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = seoMetadata({
  title: 'Сезонный пропуск',
  description: 'Бесплатный сезонный пропуск CanRush: активность на сайте открывает награды, а банка на витрине растёт с уровнем.',
  path: '/pass',
});

/** Весь экран — витрина: без шапки и таб бара сайта, выход — кнопкой на самом экране. */
export default async function PassPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <SeasonPass initial={await getSeasonPass(session?.user.id ?? null)} signedIn={Boolean(session)} daysLeft={seasonDaysLeft(moscowDay())} />;
}
