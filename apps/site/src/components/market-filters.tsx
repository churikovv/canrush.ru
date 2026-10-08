'use client';
import { useState } from 'react';
import { PriceFilterInput } from './price-filter-input';
import { DELIVERY, type MarketFilters as Filters } from '@/lib/market-fields';
export function MarketFilters({ brands, cities, initial, scope }: { brands:string[]; cities:string[]; initial:Filters; scope:Record<string,string> }) {
  const [brand,setBrand]=useState(initial.brand??'');
  const [city,setCity]=useState(initial.city??'');
  const [delivery,setDelivery]=useState(initial.delivery??'');
  return <form className="market-search-filters" method="get" action="/market">
    {Object.entries(scope).map(([key,value])=><input type="hidden" key={key} name={key} value={value}/>)}
    <div><label htmlFor="market-brand">Бренд</label><PriceFilterInput id="market-brand" value={brand} options={[...new Set([...brands,...(brand?[brand]:[])])].map(value=>({value,label:value}))} allLabel="Все бренды" onChange={setBrand}/><input type="hidden" name="brand" value={brand}/></div>
    <div><label htmlFor="market-city">Город</label><PriceFilterInput id="market-city" value={city} options={[...new Set([...cities,...(city?[city]:[])])].map(value=>({value,label:value}))} allLabel="Все города" onChange={setCity}/><input type="hidden" name="city" value={city}/></div>
    <div><label htmlFor="market-delivery">Доставка</label><PriceFilterInput id="market-delivery" value={delivery} options={Object.entries(DELIVERY).map(([value,label])=>({value,label}))} allLabel="Все способы" onChange={setDelivery}/><input type="hidden" name="delivery" value={delivery}/></div>
    <button type="submit" className="community-button">Показать</button>
    {(brand||city||delivery)&&<a href={`/market?${new URLSearchParams(scope)}`}>Сбросить</a>}
  </form>;
}
