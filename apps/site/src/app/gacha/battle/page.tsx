import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/gacha.css';
import '@/styles/battle.css';
import { headers } from 'next/headers';
import { BattleScreen } from '@/components/battle-screen';
import { auth } from '@/lib/auth';
import { getBattleHome } from '@/lib/battle';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = seoMetadata({
  title: 'Битва банок',
  description: 'Карточки энергетиков из Банкомата CanRush выходят в бой: числа карт берутся из оценок, дейтинга и цен, а победы приносят колечки на новые крутки.',
  path: '/gacha/battle',
});

/** Весь экран — игра: без шапки и таб бара сайта, выход — кнопкой на самом экране. */
export default async function BattlePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  return <BattleScreen home={session ? await getBattleHome(session.user.id) : null} signedIn={Boolean(session)} />;
}
