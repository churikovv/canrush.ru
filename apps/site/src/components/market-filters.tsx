'use client';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { useState } from 'react';
import { PriceFilterInput } from './price-filter-input';
import { DELIVERY, type MarketFilters as Filters } from '@/lib/market-fields';
/** `addHref` puts a «+» next to the filters where the page has no «Создать объявление» button of its own (/search). */
export function MarketFilters({ brands, cities, initial, scope, basePath = '/market', addHref }: { brands:string[]; cities:string[]; initial:Filters; scope:Record<string,string>; basePath?:string; addHref?:string }) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState(initial.q??'');
  const [brand,setBrand]=useState(initial.brand??'');
  const [city,setCity]=useState(initial.city??'');
  const [delivery,setDelivery]=useState(initial.delivery??'');
  return <form className="market-search-form" method="get" action={basePath}>
    {Object.entries(scope).map(([key,value])=><input type="hidden" key={key} name={key} value={value}/>)}
    <div className={`market-search-toolbar${addHref ? ' has-add' : ''}`}>
      <div className="catalog-search-field">
        <button className="market-search-submit" type="submit" aria-label="Найти объявления"><Image src="/brand/icons/catalog-search.svg" width={24} height={24} alt="" /></button>
        <input type="search" name="q" value={query} onChange={event=>setQuery(event.target.value)} maxLength={200} placeholder="Поиск объявлений" aria-label="Поиск объявлений" />
      </div>
      <button className="market-filter-toggle" type="button" aria-label="Фильтры объявлений" aria-expanded={open} aria-controls="market-filter-panel" onClick={()=>setOpen(!open)}><Image src="/brand/icons/catalog-filter.svg" width={24} height={24} alt="" />{[brand,city,delivery].filter(Boolean).length>0&&<span>{[brand,city,delivery].filter(Boolean).length}</span>}</button>
      {addHref && <Link className="market-filter-toggle store-add-button" href={addHref} aria-label="Создать объявление" title="Создать объявление"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></Link>}
    </div>
    <div className="market-search-filters" id="market-filter-panel" hidden={!open} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.market-filter-toggle')?.focus();}}}>
    <div><label htmlFor="market-brand">Бренд</label><PriceFilterInput id="market-brand" value={brand} options={[...new Set([...brands,...(brand?[brand]:[])])].map(value=>({value,label:value}))} allLabel="Все бренды" onChange={setBrand}/><input type="hidden" name="brand" value={brand}/></div>
    <div><label htmlFor="market-city">Город</label><PriceFilterInput id="market-city" value={city} options={[...new Set([...cities,...(city?[city]:[])])].map(value=>({value,label:value}))} allLabel="Все города" onChange={setCity}/><input type="hidden" name="city" value={city}/></div>
    <div><label htmlFor="market-delivery">Доставка</label><PriceFilterInput id="market-delivery" value={delivery} options={Object.entries(DELIVERY).map(([value,label])=>({value,label}))} allLabel="Все способы" onChange={setDelivery}/><input type="hidden" name="delivery" value={delivery}/></div>
    <button type="submit" className="community-button">Показать</button>
    {(brand||city||delivery||query)&&<a href={`${basePath}?${new URLSearchParams(scope)}`}>Сбросить</a>}
    </div>
  </form>;
}
