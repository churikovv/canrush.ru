import '@/styles/shared.css';
import '@/styles/profile.css';
import '@/styles/gacha.css';
import '@/styles/battle.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { BattleScreen } from '@/components/battle-screen';
import { DuelGone, DuelInvite, DuelRoom, ForgetDuelCookie } from '@/components/battle-duel';
import { auth } from '@/lib/auth';
import { duelFriends, getDuelPage, type DuelPlayer } from '@/lib/battle-duel';
import { isDuelCode } from '@/lib/battle-duel-fields';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = Promise<{ code: string }>;
const playerName = (player: DuelPlayer | null) => (player?.username ? `@${player.username}` : player?.name && !player.name.includes('@') ? player.name : 'Соперник');

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const duel = isDuelCode(code) ? await getDuelPage(code, null) : null;
  return {
    ...seoMetadata({
      title: 'Вызов на битву банок',
      description: duel ? `${playerName(duel.host)} вызывает вас на битву банок в CanRush: карточки энергетиков из Банкомата, бой один на один.` : 'Битва банок в CanRush.',
      path: `/gacha/battle/duel/${code}`,
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * Одна ссылка на все случаи: хозяину — комната ожидания со ссылкой и друзьями, гостю — «Принять вызов», участникам
 * идущего боя — сам бой, остальным — что вызов уже не действует.
 */
export default async function DuelPageRoute({ params }: { params: Params }) {
  const { code } = await params;
  if (!isDuelCode(code)) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const viewer = session?.user.id ?? null;
  const duel = await getDuelPage(code, viewer);
  if (!duel) notFound();

  let screen;
  if (duel.sync && duel.role) {
    const rival = duel.role === 'host' ? duel.guest : duel.host;
    screen = <BattleScreen home={null} signedIn duel={{ code: duel.code, sync: duel.sync, rival: { name: playerName(rival), avatarId: rival?.avatarId ?? null } }} />;
  } else if (duel.status === 'open' && duel.role === 'host') screen = <DuelRoom code={duel.code} friends={await duelFriends(duel.host.id)} />;
  else if (duel.status === 'open') return <DuelInvite code={duel.code} host={{ name: playerName(duel.host), avatarId: duel.host.avatarId }} signedIn={Boolean(viewer)} />;
  else screen = <DuelGone text={duel.status === 'active' ? 'Этот бой уже идёт без вас.' : 'Вызов уже не действует: его отменили, приняли или прошли сутки.'} />;
  // A signed-in visitor has arrived: the link kept for the way back from sign-in is no longer needed.
  return <>{viewer && <ForgetDuelCookie />}{screen}</>;
}
