import { isSiteAdminEmail } from '@/lib/admin';
import type { Metadata } from 'next';
import Link from '@/components/navigation-progress';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
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
    <Link href="/market" className="market-back">← Все объявления</Link>
    <div className="market-detail"><MarketGallery photos={listing.photos} title={listing.title} /><section className="market-detail-info">
      <p className="market-city">{listing.city}</p><h1>{listing.title}</h1><strong className="market-price">{formatPrice(listing.price)}<small> / шт.</small></strong>
      <p className="market-stock">В наличии: {listing.quantity} шт.</p>
      <MarketListingControls id={id} own={listing.sellerId === session?.user.id} closed={listing.closed} authenticated={Boolean(session)} available={listing.quantity} unitPrice={listing.price} activeOrderId={activeOrderId} />
      <p className="market-note">Кнопка «Заказать» резервирует выбранное количество и открывает переписку. Оплата и доставка происходят вне CanRush.</p>
      <dl className="market-parameters">{listing.brand && <div><dt>Бренд</dt><dd>{listing.brand}</dd></div>}<div><dt>Продавец</dt><dd>{listing.username ? <Link href={`/profile/${listing.username}`}>{listing.sellerName}</Link> : listing.sellerName}</dd></div><div><dt>Город</dt><dd>{listing.city}</dd></div><div><dt>Доставка</dt><dd>{listing.delivery.map(key => DELIVERY[key]).join(', ')}</dd></div></dl>
      <h2>Описание</h2><p className="market-full-description">{listing.description}</p>
    </section></div>
  </div></BrandShell>;
}
