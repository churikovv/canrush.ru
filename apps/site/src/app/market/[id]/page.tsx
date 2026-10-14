import { isSiteAdminEmail } from '@/lib/admin';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ProfileBackButton } from '@/components/profile-back-button';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { MarketGallery } from '@/components/market-gallery';
import { MarketListingControls } from '@/components/market-listing-controls';
import { auth } from '@/lib/auth';
import { getListing, getActiveOrderId } from '@/lib/market';
import { DELIVERY, formatPrice } from '@/lib/market-fields';
import { PHOTO_ID_PATTERN } from '@/lib/review-photo-limits';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Объявление в маркете' };
export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PHOTO_ID_PATTERN.test(id)) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerIsAdmin = session ? await isSiteAdminEmail(session.user.email) : false;
  const listing = await getListing(id, session?.user.id, viewerIsAdmin);
  if (!listing) notFound();
  const activeOrderId = session ? await getActiveOrderId(session.user.id, id) : undefined;
  return <BrandShell headerAction={<ProfileNavigation active="market" />}><div className="market-layout">
    <ProfileBackButton href="/market" label="Все объявления" />
    <div className="market-detail"><MarketGallery photos={listing.photos} title={listing.title} /><section className="market-detail-info">
      <div className="market-buy-card">
        <div className="market-tags"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>{listing.city}</span>{listing.brand && <span>{listing.brand}</span>}</div>
        <h1>{listing.title}</h1>
        <div className="market-price-row"><strong className="market-price">{formatPrice(listing.price)}<small> / шт.</small></strong><span className={`market-stock-pill${listing.quantity > 0 ? '' : ' is-empty'}`}><i aria-hidden="true" />{listing.quantity > 0 ? `В наличии ${listing.quantity} шт.` : 'Нет в наличии'}</span></div>
        <MarketListingControls id={id} own={listing.sellerId === session?.user.id} closed={listing.closed} authenticated={Boolean(session)} available={listing.quantity} unitPrice={listing.price} activeOrderId={activeOrderId} />
        <p className="market-buy-note"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>Кнопка «Заказать» резервирует выбранное количество и открывает переписку. Оплата и доставка происходят вне CanRush.</p>
      </div>
      <div className="market-seller-card"><span className="market-seller-avatar" aria-hidden="true">{listing.sellerName.slice(0, 1).toUpperCase()}</span><span className="market-seller-text"><small>Продавец</small>{listing.username ? <Link href={`/profile/${listing.username}`}>{listing.sellerName}</Link> : <strong>{listing.sellerName}</strong>}</span>{listing.username && <Link className="community-button community-button-secondary" href={`/market?seller=${encodeURIComponent(listing.username)}`}>Все объявления</Link>}</div>
      <section className="market-detail-section"><h2>Доставка</h2><div className="market-delivery-chips">{listing.delivery.map(key => <span key={key}>{DELIVERY[key]}</span>)}</div></section>
      <section className="market-detail-section"><h2>Описание</h2><p className="market-full-description">{listing.description}</p></section>
    </section></div>
  </div></BrandShell>;
}
