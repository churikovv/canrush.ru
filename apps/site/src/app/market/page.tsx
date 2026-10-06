import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import Image from 'next/image';
import { headers } from 'next/headers';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketListingControls } from '@/components/market-listing-controls';
import { auth } from '@/lib/auth';
import { getListings } from '@/lib/market';
import { DELIVERY, formatPrice } from '@/lib/market-fields';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Маркет энергетиков', description: 'Энергетики от участников CanRush. Объявления, доставка и общение с продавцами.' };
export default async function MarketPage({ searchParams }: { searchParams: Promise<{ page?: string; mine?: string; archive?: string; seller?: string }> }) {
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1));
  const session = await auth.api.getSession({ headers: await headers() });
  const seller = typeof query.seller === 'string' ? query.seller.trim().slice(0, 64) : '';
  const mine = !seller && query.mine === '1' && Boolean(session);
  const archive = mine && query.archive === '1';
  const { items, hasMore } = await getListings(page, mine ? session?.user.id : undefined, archive, seller || undefined);
  const suffix = seller ? `&seller=${encodeURIComponent(seller)}` : mine ? `&mine=1${archive ? '&archive=1' : ''}` : '';
  return <BrandShell headerAction={<ProfileNavigation active="market" />}><div className="market-layout">
    <header className="market-heading"><div><h1>{seller ? `Объявления @${seller}` : 'Маркет'}</h1>{seller ? <p><Link href={`/profile/${encodeURIComponent(seller)}`}>Вернуться в профиль</Link></p> : <p>Энергетики от участников CanRush</p>}</div><Link className="community-button" href="/market/new">Создать объявление</Link></header>
    <nav className="market-filters" aria-label="Объявления"><Link href="/market" aria-current={!mine && !seller ? 'page' : undefined}>Все объявления</Link>{session && <Link href="/market?mine=1" aria-current={mine && !archive ? 'page' : undefined}>Мои объявления</Link>}{session && <Link href="/market?mine=1&archive=1" aria-current={archive ? 'page' : undefined}>Архив</Link>}</nav>
    {items.length ? <div className="market-grid">{items.map(listing => <article className="market-card" key={listing.id}>
      <Link href={`/market/${listing.id}`} className="market-card-link">
        {listing.photos[0] && <div className="market-card-image"><Image src={`/api/market-photos/${listing.photos[0]}`} alt={listing.title} width={480} height={480} unoptimized />{listing.photos.length > 1 && <span>{listing.photos.length} фото</span>}</div>}
        <p className="market-city">{listing.city} · В наличии: {listing.quantity} шт.</p><h2>{listing.title}</h2><p className="market-card-description">{listing.description}</p>
        <div className="market-card-delivery" title={listing.delivery.map(key => DELIVERY[key]).join(', ')}>{listing.delivery.map(key => <span key={key}>{DELIVERY[key]}</span>)}</div>
      </Link>
      <div className="market-card-bottom"><strong>{formatPrice(listing.price)}<small> / шт.</small></strong><MarketListingControls id={listing.id} own={listing.sellerId === session?.user.id} closed={listing.closed} authenticated={Boolean(session)} available={listing.quantity} unitPrice={listing.price} compact /></div>
    </article>)}</div> : <section className="market-empty"><h2>{mine ? 'Ваши объявления появятся здесь' : 'Пока нет объявлений'}</h2><p>Предложите свою коллекцию или редкий вкус другим участникам.</p><Link href="/market/new">Создать объявление</Link></section>}
    <nav className="market-pagination" aria-label="Страницы объявлений">{page > 1 && <Link href={`/market?page=${page - 1}${suffix}`}>Назад</Link>}{hasMore && <Link href={`/market?page=${page + 1}${suffix}`}>Следующая страница</Link>}</nav>
    <p className="market-note">CanRush не принимает оплату и не оформляет доставку. Обсуждайте условия с продавцом и проверяйте товар перед покупкой.</p>
  </div></BrandShell>;
}
