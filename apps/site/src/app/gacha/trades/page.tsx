import '@/styles/shared.css';
import '@/styles/inventory.css';
import '@/styles/trade.css';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TradesScreen } from '@/components/card-trade';
import { auth } from '@/lib/auth';
import { listTrades, tradePartners } from '@/lib/card-trades';
import { getProfileByUserId } from '@/lib/profile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Обмены карточками', robots: { index: false, follow: false } };

/** The member's card trades: offers to answer, their own offers, the latest finished ones and whom to trade with. */
export default async function TradesPage({ searchParams }: { searchParams: Promise<{ tab?: string; notice?: string }> }) {
  const [query, session] = await Promise.all([searchParams, auth.api.getSession({ headers: await headers() })]);
  if (!session) redirect('/sign-in');
  const [trades, partners, profile] = await Promise.all([listTrades(session.user.id), tradePartners(session.user.id), getProfileByUserId(session.user.id)]);
  const tab = query.tab === 'in' || query.tab === 'out' || query.tab === 'done' ? query.tab : null;
  const notice = query.notice === 'sent' || query.notice === 'done' ? query.notice : null;
  // Keyed by the tab: a redirect here after a trade opens that tab, not the one the screen was on.
  return <TradesScreen key={`${tab}-${notice}`} trades={trades} partners={partners} backHref={profile?.username ? `/profile/${profile.username}/cards` : '/gacha'}
    initialTab={tab} notice={notice} />;
}
