import { TierListCard } from '@/components/tier-list-card';
import { TelegramPromo } from '@/components/telegram-promo';
import { buildOfficialTierList, getCommunityTierLists, tierListProductsForPlacements } from '@/lib/tier-lists';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { HomeHero, type HomeHeroSlide } from '@/components/home-hero';
import { cheapestVariant, loadCatalogSnapshot, loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, filterCatalogGroups, flavorName } from '@/lib/catalog-query';
import { getReviewSummaries, getFeaturedReviews } from '@/lib/reviews';
import { getLeaderboard } from '@/lib/profile-experience';
import { experienceLevel } from '@/lib/experience-level';
import { LevelChip } from '@/components/level-badge';
import { MonthlyTop } from '@/components/monthly-top';
import { getMonthlyTop, settleMonthlyTop } from '@/lib/monthly-top';
import { DEFAULT_DESCRIPTION, seoMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
const TOP_DRINKS = 100;
const HOME_TIER_LISTS = 8;
export const metadata = seoMetadata({ title: 'Энергетики, отзывы и рейтинг пользователей', description: DEFAULT_DESCRIPTION, path: '/' });

export default async function HomePage() {
  const { groups } = await loadCatalogSnapshot();
  await settleMonthlyTop();
  const [summaries, users, monthly] = await Promise.all([getReviewSummaries(groups), getLeaderboard(), getMonthlyTop()]);
  const resolved = groups.filter(group => isResolvedFlavor(group.flavor));
  const ranked = filterCatalogGroups(resolved, { query: '', brand: '', flavor: '', sort: 'rating' }, summaries);
  const top = ranked.slice(0, TOP_DRINKS);
  const allGroups = await loadAllCatalogGroups();
  // Hero: top-rated drinks with a photo, preferring ones that have a review worth quoting.
  const candidates = ranked.filter(group => group.coverImageUrl && summaries.get(`${group.brand}\u0000${group.flavor}`)?.count).slice(0, 12);
  const [official, tierlists, featuredReviews] = await Promise.all([buildOfficialTierList(allGroups), getCommunityTierLists(HOME_TIER_LISTS), getFeaturedReviews(candidates)]);
  const quoted = (group: CatalogGroup) => featuredReviews.has(`${group.brand}\u0000${group.flavor}`);
  const featured = [...new Set([...candidates.filter(quoted), ...candidates, ...top.filter(group => group.coverImageUrl)])].slice(0, 3);
  const tierProducts = tierListProductsForPlacements(allGroups, tierlists.flatMap(list => list.preview));
  const slides: HomeHeroSlide[] = featured.map(group => {
    const key = `${group.brand}\u0000${group.flavor}`;
    const summary = summaries.get(key);
    return { key, href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`, brand: group.brand, flavor: flavorName(group.flavor), imageUrl: group.coverImageUrl ?? null,
      rating: summary?.count ? summary.overall : null, reviewCount: summary?.count ?? 0,
      retailers: new Set(group.variants.map(variant => variant.retailer ?? variant.source)).size, minPrice: cheapestVariant(group)?.price ?? null,
      review: featuredReviews.get(key) ?? null };
  });
  return <BrandShell headerAction={<ProfileNavigation active="home" />} surfaceClassName="catalog-surface home-surface">
    <div className="home-layout">
      <h1 className="sr-only">CanRush — энергетики, отзывы и рейтинг пользователей</h1>
      {slides.length > 0 && <HomeHero slides={slides} />}
      <section className="home-section" aria-labelledby="home-users"><div className="home-section-heading"><h2 id="home-users">Рейтинг пользователей</h2><Link href="/leaderboard">Все</Link></div>
        <MonthlyTop data={monthly} />
        <h3 className="leaderboard-subheading">За всё время</h3>
        <ol className="experience-leaderboard">{users.slice(0, 5).map(user => <li key={user.username}><Link href={`/profile/${user.username}`}><span className="leaderboard-rank">{user.rank}</span><span className="wall-avatar">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={40} height={40} unoptimized alt="" /> : user.username[0]?.toUpperCase()}</span><span className="leaderboard-name">@{user.username}<small><LevelChip level={experienceLevel(user.xp).level} /></small></span><strong>{user.xp.toLocaleString('ru-RU')} XP</strong></Link></li>)}</ol>
        {!users.length && <p className="community-empty">Оставьте первый отзыв, чтобы попасть в рейтинг.</p>}
      </section>
      <section className="home-section" aria-labelledby="home-tierlists">
        <div className="home-section-heading"><h2 id="home-tierlists">Тирлисты</h2><Link href="/tierlists">Все</Link></div>
        <div className="home-tier-cards" role="region" aria-label="Тирлисты" tabIndex={0}><article className="tier-list-card tier-list-card-official"><Link href="/tierlists" className="tier-list-card-preview tier-list-card-preview-official" aria-label="Открыть официальный тирлист">{['SS','S','A','B','C','D'].map(tier => <span key={tier} className={`tier-letter tier-letter-${tier.toLowerCase()}`}>{tier}</span>)}</Link><div className="tier-list-card-copy"><h3><Link href="/tierlists">Официальный рейтинг CanRush</Link></h3><p>{official.ratedCount ? `Напитков с оценками: ${official.ratedCount}` : 'Ждём первых оценок'}</p><div className="tier-list-card-official-note">Рейтинг сообщества на основе оценок напитков. В него попадают позиции с тремя оценками и более.</div></div></article>{tierlists.map(list => <TierListCard key={list.id} list={list} products={tierProducts} />)}</div>
      </section>
      <section aria-labelledby="home-top" className="home-section">
        <div className="home-section-heading"><h2 id="home-top">Топ-{TOP_DRINKS} энергетиков</h2><Link href="/catalog?sort=rating">Все</Link></div>
        {top.length ? <ol className="home-drink-strip" aria-label={`Топ-${TOP_DRINKS} энергетиков`} tabIndex={0}>{top.map((group, index) => <li key={`${group.brand}:${group.flavor}`} className="home-drink-item"><span className="home-drink-rank" aria-label={`Место ${index + 1}`}>{index + 1}</span><CatalogProductCard group={group} eager={false} summary={summaries.get(`${group.brand}\u0000${group.flavor}`)} /></li>)}</ol> : <p className="community-empty">Здесь появятся напитки с отзывами. <Link href="/catalog">Выберите напиток и поделитесь впечатлениями.</Link></p>}
      </section>
      <TelegramPromo />
    </div>
  </BrandShell>;
}
