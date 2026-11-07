'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PriceFilterInput } from '@/components/price-filter-input';

/**
 * Поиск индекса цен — тот же, что у магазинов и маркета: поле с лупой и кнопка фильтров с панелью. Поле понимает город и
 * бренд («Казань», «берн»), иначе сужает списки по названию; в панели — город и бренд явно. Отправляется GET на /prices.
 */
export function PriceIndexSearch({ query, city, brand, cities, brands }: {
  query: string; city: string; brand: string; cities: { value: string; label: string }[]; brands: string[];
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(query);
  const [place, setPlace] = useState(city);
  const [maker, setMaker] = useState(brand);
  const active = [city, brand].filter(Boolean).length;
  return <form className="market-search-form price-index-search" method="get" action="/prices" role="search">
    <div className="market-search-toolbar">
      <div className="catalog-search-field">
        <button className="market-search-submit" type="submit" aria-label="Найти"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button>
        <input type="search" name="q" value={text} onChange={event => setText(event.target.value)} maxLength={60} placeholder="Бренд, сеть или город" aria-label="Поиск по индексу цен" enterKeyHint="search" />
      </div>
      <button className="market-filter-toggle" type="button" aria-label={active ? `Фильтры, выбрано: ${active}` : 'Фильтры'} aria-expanded={open} aria-controls="price-index-filters" onClick={() => setOpen(!open)}>
        <Image src="/brand/icons/catalog-filter.svg" width={24} height={24} alt="" />{active > 0 && <span>{active}</span>}
      </button>
    </div>
    <div className="market-search-filters price-index-filters" id="price-index-filters" hidden={!open}
      onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.market-filter-toggle')?.focus(); } }}>
      <div><label htmlFor="price-index-city">Город</label><PriceFilterInput id="price-index-city" value={place} options={cities} allLabel="Вся Россия" onChange={setPlace} /><input type="hidden" name="city" value={place} /></div>
      <div><label htmlFor="price-index-brand">Бренд</label><PriceFilterInput id="price-index-brand" value={maker} options={brands.map(value => ({ value, label: value }))} allLabel="Все бренды" onChange={setMaker} /><input type="hidden" name="brand" value={maker} /></div>
      <button type="submit" className="community-button">Показать</button>
      {(city || brand || query) && <a className="community-button community-button-secondary" href="/prices">Сбросить</a>}
    </div>
  </form>;
}
