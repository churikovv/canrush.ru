'use client';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useState } from 'react';
import { PriceFilterInput } from './price-filter-input';

/**
 * Store search with a filter panel like the market's: brand of a linked drink and, in cities with metro, the station.
 * `addHref` puts a «+» next to the filters where the page has no «Добавить магазин» button of its own (/search).
 */
export function StoreFilters({ brands, stations, initial, scope, basePath, addHref }: { brands: string[]; stations: string[]; initial: { q: string; brand: string; metro: string }; scope: Record<string, string>; basePath: string; addHref?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initial.q);
  const [brand, setBrand] = useState(initial.brand);
  const [metro, setMetro] = useState(initial.metro);
  const active = [brand, metro].filter(Boolean).length;
  const options = (values: string[], current: string) => [...new Set([...values, ...(current ? [current] : [])])].map(value => ({ value, label: value }));
  return <form className="market-search-form" method="get" action={basePath}>
    {Object.entries(scope).map(([key, value]) => <input type="hidden" key={key} name={key} value={value} />)}
    <div className={`market-search-toolbar${addHref ? ' has-add' : ''}`}>
      <div className="catalog-search-field">
        <button className="market-search-submit" type="submit" aria-label="Найти магазины"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button>
        <input type="search" name="q" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="Название, адрес или напиток" aria-label="Поиск магазинов" />
      </div>
      <button className="market-filter-toggle" type="button" aria-label="Фильтры магазинов" aria-expanded={open} aria-controls="store-filter-panel" onClick={() => setOpen(!open)}><Image src="/brand/icons/catalog-filter.svg" width={24} height={24} alt="" />{active > 0 && <span>{active}</span>}</button>
      {addHref && <Link className="market-filter-toggle store-add-button" href={addHref} aria-label="Добавить магазин" title="Добавить магазин"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></Link>}
    </div>
    <div className="market-search-filters store-search-filters" id="store-filter-panel" hidden={!open} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.market-filter-toggle')?.focus(); } }}>
      <div><label htmlFor="store-brand">Бренд</label><PriceFilterInput id="store-brand" value={brand} options={options(brands, brand)} allLabel="Все бренды" onChange={setBrand} /><input type="hidden" name="brand" value={brand} /></div>
      {(stations.length > 0 || metro) && <div><label htmlFor="store-metro">Метро</label><PriceFilterInput id="store-metro" value={metro} options={options(stations, metro)} allLabel="Все станции" onChange={setMetro} /><input type="hidden" name="metro" value={metro} /></div>}
      <button type="submit" className="community-button">Показать</button>
      {(brand || metro || query) && <a href={`${basePath}?${new URLSearchParams(scope)}`}>Сбросить</a>}
    </div>
  </form>;
}
