import { BrandShell } from '@/components/brand-shell';
import { ProfileNavigation } from '@/components/profile-navigation';
import { RetailerPriceChart } from '@/components/retailer-price-chart';
import { loadCatalogSnapshot } from '@/lib/catalog';
import { preparePriceObservations } from '@/lib/price-statistics';
import { seoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = seoMetadata({
  title: 'Цены по магазинам',
  description: 'Средняя и медианная цена энергетиков по магазинам с фильтрами бренда и объёма.',
  path: '/prices',
});

export default async function PricesPage() {
  const { groups, generatedAt, city, status } = await loadCatalogSnapshot();
  const observations = generatedAt ? preparePriceObservations(groups, generatedAt).observations : [];
  const date = generatedAt ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'Europe/Moscow' }).format(new Date(generatedAt)) : null;
  return (
    <BrandShell headerAction={<ProfileNavigation active="prices" />} surfaceClassName="price-analytics-surface">
      <div className="price-analytics">
        <header className="price-analytics-heading">
          <h1>Цены по магазинам</h1>
          <p className="price-chart-date">{city.name}{status === 'stale' ? ' · Последние доступные цены' : ''}</p>
          {date && <p className="price-chart-date">Обновлено {date}</p>}
        </header>
        {observations.length ? <RetailerPriceChart key={city.id} observations={observations} /> : <p className="price-chart-empty">Для сравнения пока недостаточно данных. Они появятся после обновления каталога.</p>}
      </div>
    </BrandShell>
  );
}
