'use client';

import { useMemo, useState } from 'react';
import { retailerPriceStatistics, type PriceObservation } from '@/lib/price-statistics';

const money = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function RetailerPriceChart({ observations }: { observations: PriceObservation[] }) {
  const [brand, setBrand] = useState('');
  const [volume, setVolume] = useState('');
  const [metric, setMetric] = useState<'mean' | 'median'>('mean');
  const brands = useMemo(() => [...new Set(observations.map(row => row.brand))].sort((a, b) => a.localeCompare(b, 'ru')), [observations]);
  const volumes = useMemo(() => [...new Set(observations.map(row => row.volumeMl))].sort((a, b) => a - b), [observations]);
  const rows = useMemo(() => retailerPriceStatistics(observations, brand, volume ? Number(volume) : undefined)
    .sort((a, b) => a[metric] - b[metric] || a.retailer.localeCompare(b.retailer, 'ru')), [observations, brand, volume, metric]);
  const max = Math.max(1, ...rows.map(row => row[metric]));
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const unit = volume ? `₽ за ${volume} мл` : '₽ за 100 мл';
  function reset() { setBrand(''); setVolume(''); setMetric('mean'); }

  return (
    <div className="price-comparison">
      <div className="price-chart-controls">
        <label>Бренд<select value={brand} onChange={event => setBrand(event.target.value)}><option value="">Все бренды</option>{brands.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Объём<select value={volume} onChange={event => setVolume(event.target.value)}><option value="">Все объёмы · за 100 мл</option>{volumes.map(value => <option value={value} key={value}>{value} мл</option>)}</select></label>
        <label>Показатель<select value={metric} onChange={event => setMetric(event.target.value as 'mean' | 'median')}><option value="mean">Средняя цена</option><option value="median">Медианная цена</option></select></label>
      </div>
      <div className="price-chart-summary" aria-live="polite">
        <h2>{metric === 'mean' ? 'Средняя' : 'Медианная'} цена <span>{unit}</span></h2>
        <p>Магазинов: {rows.length} · Позиций: {count}</p>
      </div>
      {rows.length ? (
        <>
          <p className="price-chart-hint">{volume ? `Сравниваем только объём ${volume} мл.` : 'Цена каждой позиции приведена к 100 мл, чтобы сравнивать разные объёмы.'} Чем короче полоса, тем ниже цена.</p>
          <table className="price-chart-table">
            <caption className="sr-only">{metric === 'mean' ? 'Средняя' : 'Медианная'} цена по магазинам, {unit}. Сортировка от меньшей к большей.</caption>
            <thead><tr><th scope="col">Магазин</th><th scope="col">Цена, {unit}</th><th scope="col">Позиций</th></tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.retailer}>
                <th scope="row">{row.retailer}</th>
                <td><div className="price-chart-value"><span className="price-chart-track" aria-hidden="true"><span style={{ width: `${row[metric] / max * 100}%` }} /></span><strong>{money.format(row[metric])}</strong></div></td>
                <td>{row.count}{row.count < 3 ? <span className="sr-only">, мало данных</span> : null}</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="price-chart-hint">При 1–2 позициях оценка магазина особенно чувствительна к ассортименту.</p>
        </>
      ) : (
        <div className="price-chart-empty"><h2>Нет данных для такого сочетания</h2><p>Выберите другой бренд или объём.</p><button type="button" onClick={reset}>Сбросить фильтры</button></div>
      )}
    </div>
  );
}
