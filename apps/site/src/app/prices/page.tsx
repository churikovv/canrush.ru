import '@/styles/shared.css';
import '@/styles/market.css';
import '@/styles/prices.css';
import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { StoreTabs } from '@/components/section-tabs';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { PriceIndexDetails, PriceIndexSection, cityName } from '@/components/price-index';
import { PriceIndexSearch } from '@/components/price-index-search';
import { getPriceIndexData, resolveIndexFilter, viewFor } from '@/lib/price-index';
import { dayOf } from '@/lib/price-index-fields';
import { selectedCity } from '@/lib/location';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({
  title: 'Цены на энергетики',
  description: 'Индекс цен на энергетики: сколько стоит банка 0,45 на полке и с акцией, как цены менялись за 90 дней, где дешевле по городам, сетям и брендам.',
  path: '/prices',
});

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

/**
 * /prices — «Индекс энергетиков»: поиск с фильтрами (город, бренд), карточка типичной банки с видом «90 дней» и «Где
 * дешевле» по городам, сетям и брендам. Данные считает фоновая задача (`price-index.ts`), страница только выбирает.
 */
export default async function PricesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, session, data, city] = await Promise.all([searchParams, auth.api.getSession({ headers: await headers() }),
    getPriceIndexData().catch(error => { console.error('[price-index] read failed', error instanceof Error ? error.message : 'unknown'); return null; }), selectedCity()]);
  const { filter, query } = data ? resolveIndexFilter({ city: one(params.city), brand: one(params.brand), q: one(params.q) }, data) : { filter: {}, query: '' };
  const view = data ? viewFor(data, filter) : null;
  return (
    <BrandShell headerAction={<ProfileNavigation active="prices" />} surfaceClassName="price-analytics-surface">
      <div className="price-analytics">
        <header className="price-analytics-heading">
          <div className="price-heading-title"><h1>Цены на энергетики</h1><span className="price-heading-city">{filter.city ? cityName(filter.city) : 'Вся Россия'}</span></div>
          {data && <div className="price-heading-meta"><p className="price-chart-date">Обновлено {dayOf(data.lastDay)}</p></div>}
        </header>
        <StoreTabs active="prices" signedIn={Boolean(session)} />
        {data && <PriceIndexSearch key={`${filter.city ?? ''}|${filter.brand ?? ''}|${query}`} query={query} city={filter.city ?? ''} brand={filter.brand ?? ''} brands={data.brands}
          cities={data.cities.map(id => ({ value: id, label: cityName(id) })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))} />}
        {view
          ? <><PriceIndexSection view={view} filter={filter} visitorCity={city.id} /><PriceIndexDetails view={view} filter={filter} query={query} visitorCity={city.id} /></>
          : <p className="price-chart-empty">{data ? 'По этому фильтру цен пока нет. Попробуйте другой город или бренд.' : 'Индекс цен появится после обновления данных.'}</p>}
      </div>
    </BrandShell>
  );
}
