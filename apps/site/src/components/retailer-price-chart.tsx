'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PriceFilterInput } from '@/components/price-filter-input';
import { compareRetailerPrices, type PriceObservation, type PriceSort } from '@/lib/price-statistics';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function RetailerPriceChart({ observations, retailerBadges }: { observations: PriceObservation[]; retailerBadges: Record<string, ReactNode> }) {
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState<PriceSort>('median');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const brands = useMemo(() => [...new Set(observations.map(row => row.brand))].sort((a, b) => a.localeCompare(b, 'ru')), [observations]);
  const { rows, count, average } = useMemo(() => compareRetailerPrices(observations, brand, undefined, sort, direction), [observations, brand, sort, direction]);
  function reset() { setBrand(''); setSort('median'); setDirection('asc'); }

  function changeSort(key: PriceSort) {
    setDirection(sort === key ? (direction === 'asc' ? 'desc' : 'asc') : key === 'count' ? 'desc' : 'asc');
    setSort(key);
  }
  function sortHeader(key: PriceSort, label: string) {
    return <th scope="col" aria-sort={sort === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="price-sort-heading" onClick={() => changeSort(key)}>
        {label}<span aria-hidden="true">{sort === key ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>;
  }

  return (
    <div className="price-comparison">
      <div className="price-chart-controls">
        <section className="price-filter-step" aria-labelledby="price-brand-label">
          <div className="price-step-heading"><div><label id="price-brand-label" htmlFor="price-brand">Бренды</label><p>Выберите бренд для сравнения.</p></div></div>
          <PriceFilterInput id="price-brand" value={brand} allLabel="Все бренды" options={brands.map(value => ({ value, label: value }))} onChange={value => { setBrand(value); }} />
        </section>

      </div>
      <section className="price-results" aria-labelledby="price-results-title">
        <div className="price-chart-summary">
          <div><h2 id="price-results-title">Магазины <span>₽ / 100 мл</span></h2><p aria-live="polite">Магазины: {rows.length} · Позиции: {count}</p></div>
          <div className="price-results-actions">
            {(brand || sort !== 'median' || direction !== 'asc') && <button type="button" className="price-reset" onClick={reset}>Сбросить</button>}
            <label className="price-sort">Сортировка<select value={`${sort}:${direction}`} onChange={event => {
              const [key, order] = event.target.value.split(':');
              setSort(key as PriceSort); setDirection(order as 'asc' | 'desc');
            }}>{([{ key: 'median', label: 'Медианная цена' }, { key: 'count', label: 'Количество позиций' }, { key: 'retailer', label: 'Магазин' }, { key: 'deviation', label: 'К средней' }] as const).flatMap(({ key, label }) =>
              (['asc', 'desc'] as const).map(order => <option key={`${key}:${order}`} value={`${key}:${order}`}>{label} {order === 'asc' ? '↑' : '↓'}</option>))}</select></label>
          </div>
        </div>
        {rows.length ? (
          <div className="price-table-scroll" role="region" aria-label="Сравнение цен магазинов" tabIndex={0}>
            <table className="price-chart-table">
              <caption className="sr-only">Цены за 100 мл. При равной медианной цене выше магазин с большим количеством позиций. Чип сравнивает медиану магазина со средней ценой всех выбранных позиций: {money.format(average)} ₽.</caption>
              <thead><tr>{sortHeader('retailer', 'Магазин')}{sortHeader('median', 'Медианная цена')}{sortHeader('count', 'Позиций')}{sortHeader('deviation', `К средней ${money.format(average)} ₽`)}</tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.retailer}>
                  <th scope="row"><span className="price-retailer-name">{retailerBadges[row.retailer]}<span>{row.retailer}</span></span></th>
                  <td className="price-median"><strong>{money.format(row.median)} ₽</strong></td>
                  <td className="price-count"><span className="price-mobile-label">Позиций: </span>{row.count}</td>
                  <td><span className={`price-status price-status--${row.deviation < 0 ? 'below' : row.deviation > 0 ? 'above' : 'equal'}`}>
                    {row.deviation === 0 ? 'На уровне средней' : `${row.deviation < 0 ? 'Ниже' : 'Выше'} на ${Math.abs(row.deviation)}%`}
                  </span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="price-chart-empty"><h2>Нет подходящих позиций</h2><button type="button" onClick={reset}>Сбросить фильтры</button></div>
        )}
      </section>
    </div>
  );
}
