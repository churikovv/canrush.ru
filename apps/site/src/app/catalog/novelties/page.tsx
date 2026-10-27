import '@/styles/shared.css';
import '@/styles/catalog.css';
import type { Metadata } from 'next';
import type { CatalogGroup } from '@canrush/shared';
import { BrandShell } from '@/components/brand-shell';
import { CatalogProductCard } from '@/components/catalog-product-card';
import Link from '@/components/navigation-progress';
import { ProfileBackButton } from '@/components/profile-back-button';
import { ProfileNavigation } from '@/components/profile-navigation';
import { loadAllCatalogGroups, loadCatalogSnapshot } from '@/lib/catalog';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { getNovelties } from '@/lib/novelties';
import { NOVELTY_DAYS, noveltyKey } from '@/lib/novelty-fields';
import { getReviewSummaries } from '@/lib/reviews';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = seoMetadata({
  title: 'Новинки энергетиков',
  description: 'Новые энергетики и вкусы, которые недавно появились в магазинах и в каталоге CanRush.',
  path: '/catalog/novelties',
});

const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
const PERIODS = [{ days: 7, title: 'За неделю' }, { days: 30, title: 'За месяц' }, { days: Infinity, title: 'Раньше' }];

/**
 * «Новинки»: drinks new to the catalog over the last NOVELTY_DAYS days, newest first, in three periods. A drink on sale
 * in the viewer's city shows its prices; elsewhere it is a card without offers, like the archive.
 */
export default async function NoveltiesPage() {
  const [novelties, snapshot, all] = await Promise.all([getNovelties().catch(() => []), loadCatalogSnapshot(), loadAllCatalogGroups()]);
  const inCity = new Map(snapshot.groups.map(group => [noveltyKey(group.brand, group.flavor), group]));
  const known = new Map(all.map(group => [noveltyKey(group.brand, group.flavor), group]));
  const items = novelties.flatMap(item => {
    const key = noveltyKey(item.brand, item.flavor);
    const group: CatalogGroup | undefined = inCity.get(key) ?? (known.has(key) ? { ...known.get(key)!, variants: [], minPrice: 0 } : undefined);
    return group && isCountedCatalogDrink(group) ? [{ ...item, group }] : [];
  });
  const summaries = await getReviewSummaries(items.map(({ group }) => ({ brand: group.brand, flavor: group.flavor })));
  const sections = PERIODS.map((period, index) => ({
    ...period,
    items: items.filter(item => item.age < period.days && (index === 0 || item.age >= PERIODS[index - 1]!.days)),
  })).filter(section => section.items.length);
  return <BrandShell headerAction={<ProfileNavigation active="catalog" />} surfaceClassName="catalog-surface">
    <div className="catalog-layout catalog-novelties">
      <ProfileBackButton href="/catalog" label="Каталог" />
      <header className="catalog-novelties-heading">
        <h1>Новинки</h1>
        <p>Вкусы, которые появились в магазинах и в каталоге за последние {NOVELTY_DAYS} дней. Цены — {snapshot.city.name}.</p>
      </header>
      {sections.length ? sections.map(section => <section key={section.title} aria-label={section.title}>
        <h2 className="catalog-novelties-period">{section.title} <small>{section.items.length}</small></h2>
        <div className="catalog-grid">{section.items.map((item, index) => <div key={noveltyKey(item.brand, item.flavor)} className="catalog-novelty">
          <span className="catalog-novelty-badge">{item.added ? 'Участник · ' : ''}{day.format(item.at)}</span>
          <CatalogProductCard group={item.group} eager={index < 4} summary={summaries.get(`${item.group.brand}\u0000${item.group.flavor}`)} />
        </div>)}</div>
      </section>)
        : <div className="catalog-pending-empty"><strong>Пока без новинок</strong><span>Как только в магазинах появится новый вкус, он окажется здесь. А если вы нашли напиток, которого нет в каталоге, — добавьте его.</span><Link className="community-button" href="/catalog/new">Добавить напиток</Link></div>}
    </div>
  </BrandShell>;
}
