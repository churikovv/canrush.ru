import '@/styles/shared.css';
import '@/styles/inventory.css';
import '@/styles/trade.css';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { TradeBuilder } from '@/components/card-trade';
import { auth } from '@/lib/auth';
import { getTradeDesk } from '@/lib/card-trades';
import { getProfileByUsername } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Обмен карточками', robots: { index: false, follow: false } };

/** The trade builder with one member: a game screen like the collection, without the site header. */
export default async function CardTradePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();
  if (!session) redirect('/sign-in');
  if (session.user.id === profile.id) redirect('/gacha/trades');
  const desk = await getTradeDesk(session.user.id, profile.id);
  return <TradeBuilder partner={{ id: profile.id, name: profile.name, username: profile.username, avatarId: profile.avatarId }} desk={desk} backHref={`/profile/${profile.username}/cards`} />;
}
