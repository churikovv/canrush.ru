import { TelegramPromo } from '@/components/telegram-promo';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { HomeHero } from '@/components/home-hero';
import { HomeShortcuts } from '@/components/home-shortcuts';
import { RetailerBadge } from '@/components/retailer-badge';
import { loadCatalogSnapshot } from '@/lib/catalog';
import { filterCatalogGroups } from '@/lib/catalog-query';
import { buildHomeHero, getHomeCounts } from '@/lib/home-hero';
import { getReviewSummaries, getFeaturedReviews } from '@/lib/reviews';
import { getListings } from '@/lib/market';
import { DELIVERY, formatPrice } from '@/lib/market-fields';
import { listStorePoints } from '@/lib/stores';
import { storeStations } from '@/components/store-card';
import { HomeStoreMap } from '@/components/home-store-map';
import { MonthlyTop } from '@/components/monthly-top';
import { getMonthlyTop, settleMonthlyTop } from '@/lib/monthly-top';
import { DEFAULT_DESCRIPTION, seoMetadata } from '@/lib/seo';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ContestBanner } from '@/components/contest-banner';
import { currentContest } from '@/lib/contest';
import { getContestEntry } from '@/lib/contest-db';
import { BetaEngineBanner } from '@/components/beta-engine-banner';
import { BETA_ENGINE_PLACES, getBetaEngine } from '@/lib/beta-engine';
export const dynamic = 'force-dynamic';
const TOP_DRINKS = 100;
const HOME_LISTINGS = 8;
export const metadata = seoMetadata({ title: 'Энергетики, отзывы и рейтинг пользователей', description: DEFAULT_DESCRIPTION, path: '/' });

export default async function HomePage() {
  const { groups, city } = await loadCatalogSnapshot();
  await settleMonthlyTop();
  const contest = currentContest(new Date());
  const [summaries, monthly, listings, storePoints, session] = await Promise.all([getReviewSummaries(groups), getMonthlyTop(), getListings(1), listStorePoints(city.id), auth.api.getSession({ headers: await headers() })]);
  const [contestEntry, engine] = await Promise.all([contest && session ? getContestEntry(contest.contest, session.user.id) : null, getBetaEngine(session?.user.id ?? null)]);
  const stores = storePoints.map(store => ({ id: store.id, name: store.name, address: store.address, station: storeStations(store, 1)[0]?.name ?? null, latitude: store.latitude, longitude: store.longitude, drinks: store.drinks }));
  const resolved = groups.filter(group => isResolvedFlavor(group.flavor));
  const ranked = filterCatalogGroups(resolved, { query: '', brand: '', flavor: '', sort: 'rating' }, summaries);
  const top = ranked.slice(0, TOP_DRINKS);
  // Hero gallery: top-rated drinks with a photo, preferring ones that have a review worth quoting.
  const candidates = ranked.filter(group => group.coverImageUrl && summaries.get(`${group.brand}\u0000${group.flavor}`)?.count).slice(0, 12);
  const [featuredReviews, counts] = await Promise.all([getFeaturedReviews(candidates), getHomeCounts()]);
  const quoted = (group: CatalogGroup) => featuredReviews.has(`${group.brand}\u0000${group.flavor}`);
  const featured = [...new Set([...candidates.filter(quoted), ...candidates, ...top.filter(group => group.coverImageUrl)])].slice(0, 3);
  const hero = buildHomeHero({ groups: resolved, ranked, featured, summaries, reviews: featuredReviews, counts });
  const retailerBadges = Object.fromEntries([...new Set([...hero.slides.flatMap(slide => slide.kind === 'drink' && slide.drink.retailer ? [slide.drink.retailer] : []), ...hero.retailers])].map(name => [name, <RetailerBadge key={name} name={name} decorative />]));
  return <BrandShell headerAction={<ProfileNavigation active="home" />} surfaceClassName="catalog-surface home-surface">
    <div className="home-layout">
      <HomeHero data={hero} badge={null} retailerBadges={retailerBadges} />
      <HomeShortcuts />
      {contest && <ContestBanner contest={contest.contest} entry={contestEntry} phase={contest.phase} />}
      {/* Shown while places remain; holders keep their number and tag after it goes. */}
      {engine.taken < BETA_ENGINE_PLACES && <BetaEngineBanner data={engine} signedIn={!!session} />}
      <section aria-labelledby="home-top" className="home-section">
        <div className="home-section-heading"><h2 id="home-top">Топ-{TOP_DRINKS} энергетиков</h2><Link href="/catalog?sort=rating">Все</Link></div>
        {top.length ? <ol className="home-drink-strip" aria-label={`Топ-${TOP_DRINKS} энергетиков`} tabIndex={0}>{top.map((group, index) => <li key={`${group.brand}:${group.flavor}`} className="home-drink-item"><span className="home-drink-rank" aria-label={`Место ${index + 1}`}>{index + 1}</span><CatalogProductCard group={group} eager={false} summary={summaries.get(`${group.brand}\u0000${group.flavor}`)} /></li>)}</ol> : <p className="community-empty">Здесь появятся напитки с отзывами. <Link href="/catalog">Выберите напиток и поделитесь впечатлениями.</Link></p>}
      </section>
      <section aria-labelledby="home-market" className="home-section">
        <div className="home-section-heading"><h2 id="home-market">Объявления</h2><Link href="/market">Все</Link></div>
        {listings.items.length ? <ul className="home-market-strip" aria-label="Свежие объявления" tabIndex={0}>{listings.items.slice(0, HOME_LISTINGS).map(listing => <li key={listing.id} className="home-market-card">
          <Link href={`/market/${listing.id}`}>
            <span className="home-market-photo">{listing.photos[0] ? <Image src={`/api/market-photos/${listing.photos[0]}?size=thumbnail`} width={320} height={320} unoptimized alt="" /> : <span aria-hidden="true">{listing.title[0]?.toUpperCase()}</span>}</span>
            <strong className="home-market-price">{formatPrice(listing.price)}<small> / шт.</small></strong>
            <span className="home-market-title">{listing.title}</span>
            <span className="home-market-meta">{listing.city} · {listing.delivery.map(key => DELIVERY[key]).join(', ')}</span>
          </Link>
        </li>)}</ul> : <p className="community-empty">Пока нет объявлений. <Link href="/market/new">Предложите свою коллекцию или редкий вкус.</Link></p>}
      </section>
      <section className="home-section" aria-labelledby="home-users"><div className="home-section-heading"><h2 id="home-users">Рейтинг пользователей</h2><Link href="/leaderboard">Все</Link></div>
        <MonthlyTop data={monthly} />
      </section>
      <TelegramPromo />
      <section aria-labelledby="home-stores" className="home-section home-stores">
        <div className="home-section-heading"><h2 id="home-stores">Магазины на карте</h2><Link href="/market/stores">Все</Link></div>
        {stores.length ? <HomeStoreMap apiKey={process.env.YANDEX_MAPS_API_KEY ?? ''} center={[city.lat, city.lng]} stores={stores} /> : <p className="community-empty">Здесь пока нет магазинов на карте. <Link href={`/market/stores/new?city=${city.id}`}>Добавьте знакомый магазин.</Link></p>}
      </section>
    </div>
  </BrandShell>;
}
