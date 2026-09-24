import Link from 'next/link';
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
  const { groups, generatedAt } = await loadCatalogSnapshot();
  const observations = generatedAt ? preparePriceObservations(groups, generatedAt).observations : [];
  const date = generatedAt ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'Europe/Moscow' }).format(new Date(generatedAt)) : null;
  return (
    <BrandShell headerAction={<ProfileNavigation active="prices" />} surfaceClassName="price-analytics-surface">
      <div className="price-analytics">
        <Link href="/catalog">← Каталог</Link>
        <header className="price-analytics-heading">
          <h1>Цены по магазинам</h1>
          <p>Сравните среднюю или медианную цену энергетиков в ассортименте каждой сети.</p>
          <p className="price-chart-hint">{date ? `Срез каталога: ${date}` : 'Данные пока не загружены.'}{date ? ' Цены на дату среза; сегодня они могут отличаться.' : ''}</p>
        </header>
        <p className="price-analytics-notice">Ассортимент магазинов различается. Большинство предложений — акции из Едадила: график не сравнивает одинаковую корзину и не определяет самый дешёвый магазин.</p>
        {observations.length ? <RetailerPriceChart observations={observations} /> : <p className="price-chart-empty">Для сравнения пока недостаточно данных. Они появятся после обновления каталога.</p>}
        <details className="price-chart-method">
          <summary>Как считаем цены</summary>
          <p>Средняя — сумма цен, делённая на число позиций. Медиана — цена в середине отсортированного ряда; при чётном числе позиций берём среднее двух центральных цен.</p>
          <p>Одна позиция — сочетание бренда, вкуса и объёма в магазине. При повторных предложениях берём минимальную цену. У каждой позиции одинаковый вес: данные о продажах не используются.</p>
          <p>Для всех объёмов сначала пересчитываем каждую цену на 100 мл. При выборе объёма показываем цену за банку. Исключаем предложения без объёма или с явно ошибочным объёмом более 5 л, отмеченные как устаревшие, акции, истёкшие на дату среза, и распознанные упаковки из нескольких банок.</p>
          <p>Количество позиций показано рядом с ценой. Небольшая выборка и различия в брендах могут заметно влиять на результат. Цены в конкретном магазине и регионе могут отличаться.</p>
        </details>
      </div>
    </BrandShell>
  );
}
