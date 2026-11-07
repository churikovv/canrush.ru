'use client';

import { useState, type ReactNode } from 'react';
import Link from '@/components/navigation-progress';

/** A row of «Где дешевле»: `value` — the main column (a city or chain to the average, %; a brand — ₽ per litre), `extra` — the second. */
export type IndexRow = { key: string; name: string; value: number; extra: number | null; href?: string };
type Tab = 'cities' | 'chains' | 'brands';
type Column = 'name' | 'value' | 'extra';
type Sort = { by: Column; dir: 1 | -1 } | null;

const TABS: { key: Tab; label: string }[] = [{ key: 'cities', label: 'Города' }, { key: 'chains', label: 'Сети' }, { key: 'brands', label: 'Бренды' }];
const COLUMNS: Record<Tab, { name: string; value: string; extra: string; hint: string }> = {
  cities: { name: 'Город', value: 'К стране', extra: 'Банка', hint: 'К средней цене по стране — по одинаковым напиткам, на полке. Город открывает свой индекс.' },
  chains: { name: 'Сеть', value: 'К сетям', extra: 'Скидки', hint: 'К другим сетям того же города — по одинаковым напиткам, на полке.' },
  brands: { name: 'Бренд', value: 'За литр', extra: 'За месяц', hint: 'Цена литра на полке, самые распространённые первыми. Бренд открывает свой индекс.' },
};
const SHOWN = 8;
const number = (value: number) => Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(value)}%`;
const money = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const CHEVRON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
const arrow = (dir: 1 | -1 | 0) => <svg className="price-index-sort" data-dir={dir || undefined} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {dir === 0 ? <path d="m8 9 4-4 4 4M8 15l4 4 4-4" /> : <path d={dir === 1 ? 'M12 19V5m-6 6 6-6 6 6' : 'M12 5v14m-6-6 6 6 6-6'} />}
</svg>;

/**
 * «Где дешевле» — таблица в духе кабинета: шапка с сортировкой, строки во всю ширину. Город и бренд — строка-ссылка со
 * стрелкой (индекс открывается для них), сеть — просто строка. Города и сети — к среднему по одинаковым напиткам
 * (полоска влево — дешевле, вправо — дороже), бренды — цена литра. Первые восемь строк, остальные — «Показать все».
 */
export function PriceIndexLists({ cities, chains, brands, city, mineLabel, badges, start }: {
  cities: IndexRow[]; chains: IndexRow[]; brands: IndexRow[]; city: string; mineLabel: string; badges: Record<string, ReactNode>; start: Tab;
}) {
  const [tab, setTab] = useState<Tab>(start);
  const [all, setAll] = useState(false);
  const [sort, setSort] = useState<Sort>(null);
  const lists: Record<Tab, IndexRow[]> = { cities, chains, brands };
  const shown = TABS.filter(item => lists[item.key].length > 0);
  const current = lists[tab].length ? tab : shown[0]?.key ?? 'cities';
  const columns = COLUMNS[current];
  const base = lists[current];
  const rows = sort ? [...base].sort((a, b) => {
    if (sort.by === 'name') return a.name.localeCompare(b.name, 'ru') * sort.dir;
    const x = a[sort.by], y = b[sort.by];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return (x - y) * sort.dir;
  }) : base;
  const visible = all ? rows : rows.slice(0, SHOWN);
  const reach = Math.max(1, ...base.map(row => Math.abs(row.value)));
  const top = Math.max(1, ...base.map(row => row.value));
  const choose = (next: Tab) => { setTab(next); setAll(false); setSort(null); };
  const head = (by: Column, label: string) => {
    const dir = sort?.by === by ? sort.dir : 0;
    return <button type="button" className="price-index-th" data-column={by} data-active={dir ? '' : undefined}
      aria-label={`Сортировать: ${label}${dir === 1 ? ', сейчас по возрастанию' : dir === -1 ? ', сейчас по убыванию' : ''}`}
      onClick={() => setSort(dir === 1 ? { by, dir: -1 } : dir === -1 ? null : { by, dir: 1 })}>{label}{arrow(dir)}</button>;
  };
  const valueText = (row: IndexRow) => current === 'brands' ? `${Math.round(row.value)} ₽` : row.value === 0 ? 'как все' : signed(row.value);
  const extraText = (row: IndexRow) => row.extra === null ? '—'
    : current === 'cities' ? money(row.extra) : current === 'chains' ? `~${Math.round(row.extra)}%` : row.extra === 0 ? '0%' : signed(row.extra);
  return <div className="price-index-lists">
    <div className="price-index-tabs" role="tablist" aria-label="Сравнение">
      {shown.map(item => <button key={item.key} type="button" role="tab" aria-selected={current === item.key} onClick={() => choose(item.key)}>
        {item.label}<span>{lists[item.key].length}</span>
      </button>)}
    </div>
    <div className="price-index-list" role="tabpanel">
      <p className="price-index-hint">{columns.hint}</p>
      <div className="price-index-table">
        <div className="price-index-thead">
          {head('name', columns.name)}
          <span className="price-index-th-bar" aria-hidden="true">{current !== 'brands' && <><span>дешевле</span><span>дороже</span></>}</span>
          {head('value', columns.value)}
          {head('extra', columns.extra)}
          <span />
        </div>
        <ol className="price-index-rows">
          {visible.map(row => {
            const mine = current === 'cities' && row.key === city;
            const cells = <>
              <span className="price-index-cell-name">{current === 'chains' && badges[row.key]}<span>{row.name}</span>{mine && <small>{mineLabel}</small>}</span>
              {current === 'brands'
                ? <span className="price-index-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, row.value / top * 100)}%` }} /></span>
                : <span className="price-index-diverge" aria-hidden="true" data-side={row.value < 0 ? 'cheaper' : 'dearer'}><span style={{ width: `${Math.abs(row.value) / reach * 50}%` }} /></span>}
              <span className="price-index-cell-value"><span className="sr-only">{columns.value}: </span>{valueText(row)}</span>
              <span className="price-index-cell-extra"><span className="sr-only">{columns.extra}: </span>{extraText(row)}</span>
              <span className="price-index-cell-go">{row.href && CHEVRON}</span>
            </>;
            return <li key={row.key} data-mine={mine ? '' : undefined}>
              {row.href ? <Link className="price-index-tr" href={row.href} scroll={false}>{cells}</Link> : <div className="price-index-tr">{cells}</div>}
            </li>;
          })}
        </ol>
        {rows.length > SHOWN && <div className="price-index-tfoot">
          <span>{all ? `Все ${rows.length}` : `${visible.length} из ${rows.length}`}</span>
          <button type="button" className="price-index-more" aria-expanded={all} onClick={() => setAll(value => !value)}>{all ? 'Свернуть' : 'Показать все'}</button>
        </div>}
      </div>
    </div>
  </div>;
}
