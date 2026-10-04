import Image from 'next/image';
import Link from 'next/link';
import { isResolvedFlavor, type CatalogGroup } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { CatalogProductCard } from '@/components/catalog-product-card';
import { loadCatalogSnapshot } from '@/lib/catalog';
import { filterCatalogGroups } from '@/lib/catalog-query';
import { getReviewSummaries, getDiscussionCounts } from '@/lib/reviews';
import { getLeaderboard } from '@/lib/profile-experience';
import { experienceLevel } from '@/lib/experience-level';
import { seoMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({ title: 'Энергетики, отзывы и рейтинг пользователей', description: 'Лучшие и самые обсуждаемые энергетики, цены в магазинах и рейтинг участников CanRush.', path: '/' });

export default async function HomePage() {
  const { groups, city } = await loadCatalogSnapshot();
  const [summaries, discussions, users] = await Promise.all([getReviewSummaries(groups), getDiscussionCounts(), getLeaderboard()]);
  const resolved = groups.filter(group => isResolvedFlavor(group.flavor));
  const filters = { query: '', brand: '', flavor: '' };
  const available = filterCatalogGroups(groups, { ...filters, sort: 'stores' });
  function fillCollection(preferred: CatalogGroup[]) {
    const seen = new Set<string>();
    return [...preferred, ...available].filter(group => {
      const key = JSON.stringify([group.brand, group.flavor]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }
  const best = fillCollection(filterCatalogGroups(resolved.filter(group => (summaries.get(`${group.brand}\u0000${group.flavor}`)?.count ?? 0) > 0), { ...filters, sort: 'rating' }, summaries));
  const popular = fillCollection(filterCatalogGroups(resolved.filter(group => (discussions.get(`${group.brand}\u0000${group.flavor}`) ?? 0) > 0), { ...filters, sort: 'comments' }, summaries, discussions));
  return <BrandShell headerAction={<ProfileNavigation />} surfaceClassName="catalog-surface">
    <div className="home-layout">
      <header className="home-heading"><div><h1>Открывайте энергетики</h1><p>Отзывы сообщества и предложения магазинов · {city.name}</p></div><Link className="community-button community-button-secondary" href="/catalog">В каталог ↗</Link></header>
      {[{ id: 'best', title: 'Самые лучшие энергетики', href: '/catalog?sort=rating', items: best }, { id: 'discussed', title: 'Самые комментируемые', href: '/catalog?sort=comments', items: popular }].map(section => <section key={section.id} aria-labelledby={`home-${section.id}`} className="home-section">
        <div className="home-section-heading"><h2 id={`home-${section.id}`}>{section.title}</h2><Link href={section.href}>Посмотреть все ↗</Link></div>
        {section.items.length ? <div className="home-drink-strip" role="region" aria-label={section.title} tabIndex={0}>{section.items.map(group => <div key={`${group.brand}:${group.flavor}`} className="home-drink-item"><CatalogProductCard group={group} eager={section.id === 'best'} summary={summaries.get(`${group.brand}\u0000${group.flavor}`)} /></div>)}</div> : <p className="community-empty">Здесь появятся напитки с отзывами. <Link href="/catalog">Выберите напиток и поделитесь впечатлениями.</Link></p>}
      </section>)}
      <section className="home-section" aria-labelledby="home-users"><div className="home-section-heading"><h2 id="home-users">Рейтинг пользователей</h2><Link href="/leaderboard">Посмотреть все ↗</Link></div>
        <ol className="experience-leaderboard">{users.slice(0, 5).map(user => <li key={user.username}><Link href={`/profile/${user.username}`}><span className="leaderboard-rank">{user.rank}</span><span className="wall-avatar">{user.avatarId ? <Image src={`/api/profile-images/${user.avatarId}`} width={40} height={40} unoptimized alt="" /> : user.username[0]?.toUpperCase()}</span><span className="leaderboard-name">@{user.username}<small>Уровень {experienceLevel(user.xp).level}</small></span><strong>{user.xp.toLocaleString('ru-RU')} XP</strong></Link></li>)}</ol>
        {!users.length && <p className="community-empty">Оставьте первый отзыв, чтобы попасть в рейтинг.</p>}
      </section>
    </div>
  </BrandShell>;
}
