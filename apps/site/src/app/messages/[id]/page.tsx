import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketChat } from '@/components/market-chat';
import { auth } from '@/lib/auth';
import { getOrder, getMessages } from '@/lib/market';
import { isUserBlocked } from '@/lib/moderation';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Переписка по заказу', robots: { index: false, follow: false } };
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const order = await getOrder(session.user.id, id);
  if (!order) notFound();
  const [messages, blocked] = await Promise.all([getMessages(session.user.id, id), isUserBlocked(session.user.id)]);
  return <BrandShell headerAction={<ProfileNavigation active="messages" />}><div className="market-layout market-chat-layout">
    <Link className="market-back" href="/messages">← Все сообщения</Link><MarketChat key={id} initialOrder={order} initialMessages={messages.items} initialHasMore={messages.hasMore} userId={session.user.id} blocked={blocked} />
  </div></BrandShell>;
}
