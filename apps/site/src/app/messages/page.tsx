import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketInboxRefresh } from '@/components/market-inbox-refresh';
import { auth } from '@/lib/auth';
import { getOrders } from '@/lib/market';
import { ORDER_STATUS, formatPrice } from '@/lib/market-fields';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Сообщения', robots: { index: false, follow: false } };
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1));
  const { items, hasMore } = await getOrders(session.user.id, page);
  return <BrandShell headerAction={<ProfileNavigation active="messages" />}><div className="market-layout market-inbox"><MarketInboxRefresh />
    <header className="market-heading"><h1>Сообщения</h1><Link href="/market">Перейти в маркет</Link></header>
    {items.length ? <ul className="market-threads">{items.map(order => <li key={order.id}><Link href={`/messages/${order.id}`}>
      <div className="market-thread-person"><strong>{order.buyerId === session.user.id ? order.sellerName : order.buyerName}</strong><span>{order.buyerId === session.user.id ? 'Покупаете' : 'Продаёте'}</span>{order.unread > 0 && <span className="market-unread" aria-label={`${order.unread} непрочитанных сообщений`}>{order.unread}</span>}</div>
      <h2>{order.title}</h2><div className="market-thread-meta"><span>{order.quantity} шт. · {formatPrice(order.price)}</span><span>{ORDER_STATUS[order.status]}</span></div>
    </Link></li>)}</ul> : <section className="market-empty"><h2>Здесь будут ваши переписки</h2><p>Нажмите «Заказать» в объявлении, чтобы обсудить покупку с продавцом. Входящие заказы тоже появятся здесь.</p><Link href="/market">Посмотреть объявления</Link></section>}
    <nav className="market-pagination" aria-label="Страницы переписок">{page > 1 && <Link href={`/messages?page=${page - 1}`}>Назад</Link>}{hasMore && <Link href={`/messages?page=${page + 1}`}>Следующая страница</Link>}</nav>
  </div></BrandShell>;
}
