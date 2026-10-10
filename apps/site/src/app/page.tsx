import { RetailerBadge } from '@/components/retailer-badge';
import { TierListCard } from '@/components/tier-list-card';
import { buildOfficialTierList, getCommunityTierLists, tierListProductsForPlacements } from '@/lib/tier-lists';
import { preparePriceObservations, retailerPriceStatistics } from '@/lib/price-statistics';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { loadCatalogSnapshot, loadAllCatalogGroups } from '@/lib/catalog';
import { filterCatalogGroups } from '@/lib/catalog-query';
import { getReviewSummaries, getDiscussionCounts } from '@/lib/reviews';
import { getLeaderboard } from '@/lib/profile-experience';
import { experienceLevel } from '@/lib/experience-level';
import { DEFAULT_DESCRIPTION, seoMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({ title: 'Энергетики, отзывы и рейтинг пользователей', description: DEFAULT_DESCRIPTION, path: '/' });

export default async function HomePage() {
  const { groups, city, generatedAt } = await loadCatalogSnapshot();
  const [summaries, discussions, users] = await Promise.all([getReviewSummaries(groups), getDiscussionCounts(), getLeaderboard()]);
  const resolved = groups.filter(group => isResolvedFlavor(group.flavor));
  const filters = { query: '', brand: '', flavor: '' };
  const seen = new Set<string>();
  function fillCollection(preferred: CatalogGroup[]) {
    return preferred.filter(group => {
      const key = JSON.stringify([group.brand, group.flavor]);
      if (seen.has(key)) return false;
      return true;
    }).slice(0, 6).map(group => { seen.add(JSON.stringify([group.brand, group.flavor])); return group; });
  }
  const best = fillCollection(filterCatalogGroups(resolved, { ...filters, sort: 'rating' }, summaries));
  const discussed = filterCatalogGroups(resolved.filter(group => (discussions.get(`${group.brand}\u0000${group.flavor}`) ?? 0) > 0), { ...filters, sort: 'comments' }, summaries, discussions);
  const popular = fillCollection([...discussed, ...filterCatalogGroups(resolved.filter(group => !discussed.includes(group)), { ...filters, sort: 'brand' })]);
  const stats = retailerPriceStatistics(generatedAt ? preparePriceObservations(groups, generatedAt).observations : []);
  const minimumPositions = Math.max(10, Math.ceil(Math.max(0, ...stats.map(store => store.count)) / 2));
  const stores = stats.filter(store => store.count >= minimumPositions).sort((a, b) => a.median - b.median || b.count - a.count).slice(0, 5);
  const allGroups = await loadAllCatalogGroups();
  const [official, tierlists] = await Promise.all([buildOfficialTierList(allGroups), getCommunityTierLists(3)]);
  const tierProducts = tierListProductsForPlacements(allGroups, tierlists.flatMap(list => list.preview));
  return <BrandShell headerAction={<ProfileNavigation active="home" />} surfaceClassName="catalog-surface home-surface">
    <div className="home-layout">
      <header className="home-heading"><div><h1>Открывайте энергетики</h1><p>Отзывы сообщества и предложения магазинов · {city.name}</p></div><Link className="community-button community-button-secondary" href="/catalog">В каталог ↗</Link></header>
      {[{ id: 'best', title: 'Самые лучшие энергетики', href: '/catalog?sort=rating', items: best }, { id: 'discussed', title: 'Самые комментируемые', href: '/catalog?sort=comments', items: popular }].map(section => <section key={section.id} aria-labelledby={`home-${section.id}`} className="home-section">
        <div className="home-section-heading"><h2 id={`home-${section.id}`}>{section.title}</h2><Link href={section.href}>Все</Link></div>
        {section.items.length ? <div className="home-drink-strip" role="region" aria-label={section.title} tabIndex={0}>{section.items.map(group => <div key={`${group.brand}:${group.flavor}`} className="home-drink-item"><CatalogProductCard group={group} eager={section.id === 'best'} summary={summaries.get(`${group.brand}\u0000${group.flavor}`)} /></div>)}</div> : <p className="community-empty">Здесь появятся напитки с отзывами. <Link href="/catalog">Выберите напиток и поделитесь впечатлениями.</Link></p>}
      </section>)}
      <section className="home-section" aria-labelledby="home-stores">
        <div className="home-section-heading"><h2 id="home-stores">Топ дешёвых магазинов</h2><Link href="/prices">Все</Link></div>
        <p className="community-section-note">Низкая медианная цена за 100 мл среди магазинов с широким ассортиментом — от {minimumPositions} позиций.</p>
        {stores.length ? <ol className="home-store-list">{stores.map(store => <li key={store.retailer}><Link href="/prices"><span className="price-retailer-name"><RetailerBadge name={store.retailer} decorative /><span>{store.retailer}</span></span><span className="community-muted">Позиций: {store.count}</span><strong>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(store.median)} ₽ <small>/ 100 мл</small></strong></Link></li>)}</ol> : <p className="community-empty">Пока недостаточно цен для сравнения магазинов с широким ассортиментом.</p>}
      </section>
      <section className="home-section" aria-labelledby="home-tierlists">
        <div className="home-section-heading"><h2 id="home-tierlists">Тирлисты</h2><Link href="/tierlists">Все</Link></div>
        <div className="home-tier-cards"><article className="tier-list-card"><Link href="/tierlists" className="tier-list-card-preview" aria-label="Открыть официальный тирлист">{['SS','S','A','B','C','D'].map(tier => <span key={tier} className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span>)}</Link><div className="tier-list-card-copy"><h3><Link href="/tierlists">Официальный рейтинг CanRush</Link></h3><p>{official.ratedCount ? `Напитков с оценками: ${official.ratedCount}` : 'Нужно больше позиций с тремя оценками и более'}</p></div></article>{tierlists.map(list => <TierListCard key={list.id} list={list} products={tierProducts} />)}</div>
      </section>
      <section className="home-section" aria-labelledby="home-users"><div className="home-section-heading"><h2 id="home-users">Рейтинг пользователей</h2><Link href="/leaderboard">Все</Link></div>
        <ol className="experience-leaderboard">{users.slice(0, 5).map(user => <li key={user.username}><Link href={`/profile/${user.username}`}><span className="leaderboard-rank">{user.rank}</span><span className="wall-avatar">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={40} height={40} unoptimized alt="" /> : user.username[0]?.toUpperCase()}</span><span className="leaderboard-name">@{user.username}<small>Уровень {experienceLevel(user.xp).level}</small></span><strong>{user.xp.toLocaleString('ru-RU')} XP</strong></Link></li>)}</ol>
        {!users.length && <p className="community-empty">Оставьте первый отзыв, чтобы попасть в рейтинг.</p>}
      </section>
    </div>
  </BrandShell>;
}
