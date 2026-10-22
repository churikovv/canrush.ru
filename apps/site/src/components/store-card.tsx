import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { findCity } from '@canrush/shared';
import { METRO, STOCK_LABELS, formatDistance, nearestStations, storeMapUrl, type MetroStation } from '@/lib/store-fields';
import type { StoreItemView, StoreView } from '@/lib/store-catalog';
import { StoreGallery } from './store-gallery';

interface StationGroup { name: string; lines: MetroStation[]; km: number | null }
/** Chosen station first, then other nearby stations; transfer stations are grouped by name. */
export function storeStations(store: Pick<StoreView,'city'|'metro'|'latitude'|'longitude'>, limit = 2): StationGroup[] {
  const chosen = METRO[store.city]?.find(s => s.id === store.metro);
  const near = store.latitude !== null && store.longitude !== null ? nearestStations(store.city, store.latitude, store.longitude, 6) : [];
  const entries = [...(chosen && !near.some(n => n.station.id === chosen.id) ? [{ station: chosen, km: null as number | null }] : []), ...near];
  if (chosen) entries.sort((a, b) => Number(b.station.name === chosen.name) - Number(a.station.name === chosen.name));
  const groups = new Map<string, StationGroup>();
  for (const { station, km } of entries) {
    const group = groups.get(station.name) ?? { name: station.name, lines: [], km };
    if (!group.lines.some(line => line.line === station.line)) group.lines.push(station);
    groups.set(station.name, group);
  }
  return [...groups.values()].slice(0, limit);
}
export function StoreMetro({store,limit}:{store:Pick<StoreView,'city'|'metro'|'latitude'|'longitude'>;limit?:number}){
  const groups=storeStations(store,limit);
  if(!groups.length)return null;
  return <ul className="store-metro-list" aria-label="Ближайшие станции">{groups.map(group=><li key={group.name}>
    <span className="store-metro-dots" aria-hidden="true">{group.lines.map(line=><span key={line.id} className="metro-line-dot" style={{backgroundColor:line.color}}/>)}</span>
    <span><strong>{group.name}</strong><small>{group.lines.map(line=>line.line).join(', ')}</small></span>
    {group.km!==null&&<span className="store-metro-distance">{formatDistance(group.km)}</span>}
  </li>)}</ul>;
}
const rub=(price:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(price/100);
function DrinkName({item}:{item:StoreItemView}){
  const body=<>{item.cover?<Image src={item.cover} width={36} height={36} alt="" className="store-drink-cover"/>:<span className="store-drink-cover store-drink-cover-empty" aria-hidden="true"/>}<span>{item.name}<small>{item.href?STOCK_LABELS[item.availability]:`Свой напиток · ${STOCK_LABELS[item.availability].toLocaleLowerCase('ru-RU')}`}</small></span></>;
  return item.href?<Link className="store-drink-name" href={item.href}>{body}</Link>:<span className="store-drink-name">{body}</span>;
}
export function StoreCard({store,own=false,index}:{store:StoreView;own?:boolean;index?:number}){
 return <article className="store-card" id={`store-${store.id}`} tabIndex={-1}>
  <h2>{index!==undefined&&<span className="store-map-number" aria-hidden="true">{index+1}</span>}<Link href={`/market/stores/${store.id}`}>{store.name}</Link></h2>
  <p className="store-address">{storeAddressLine(store)}</p>
  <StoreMetro store={store} limit={2}/>
  <StoreGallery photos={store.photos} name={store.name} layout="strip"/>
  {store.description&&<p className="store-description">{store.description}</p>}
  {own&&<p className="store-status">{STATUS_LABELS[store.status]}{store.moderationNote&&`: ${store.moderationNote}`}</p>}
  {store.catalog.length>0&&<details><summary>Напитки и цены · {store.catalog.length}</summary><ul className="store-stock-list">{store.catalog.map((item,i)=><li key={i}><DrinkName item={item}/><strong>{item.price===null?'Цена не указана':rub(item.price)}</strong></li>)}</ul><p className="store-note">Обновлено {new Date(store.updatedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})}. Наличие и цену уточняйте в магазине.</p></details>}
  <div className="store-card-actions"><a className="community-button community-button-secondary" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах ↗</a>{own&&<Link href={`/market/stores/${store.id}/edit`} className="community-button community-button-secondary">Редактировать</Link>}</div>
 </article>;
}
/** City prefix only when the address does not already start with it. */
export function storeAddressLine(store:Pick<StoreView,'city'|'address'>){
  const city=findCity(store.city)?.name;
  return city&&!store.address.toLocaleLowerCase('ru-RU').startsWith(city.toLocaleLowerCase('ru-RU'))?`${city} · ${store.address}`:store.address;
}
function cheapestPrice(store:StoreView){
  return store.catalog.reduce<number|null>((min,item)=>item.price!==null&&item.availability!=='unavailable'&&(min===null||item.price<min)?item.price:min,null);
}
const STATUS_LABELS={pending:'На проверке',published:'Опубликован',rejected:'Нужны исправления'} as const;
/** Card of the store list: cover photo, address, metro and a short price summary; full price list is on the store page. */
export function StoreListCard({store,index,own}:{store:StoreView;index:number;own:boolean}){
  const href=`/market/stores/${store.id}`;const cheapest=cheapestPrice(store);const cover=store.photos[0];
  const covers=store.catalog.filter(item=>item.cover).slice(0,4);
  return <article className="store-card store-list-card" id={`store-${store.id}`} tabIndex={-1}>
    <Link className="store-list-cover" href={href} tabIndex={-1} aria-hidden="true">
      {cover?<Image src={`/api/store-photos/${cover}?size=card`} width={640} height={360} alt="" unoptimized/>:<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M4 10v10h16V10M3 4h18l-1 6H4L3 4Zm6 16v-6h6v6"/></svg>}
      {store.photos.length>1&&<span className="store-list-photo-count">{store.photos.length} фото</span>}
    </Link>
    <div className="store-list-body">
      {own&&<p className="store-list-status" data-status={store.status}>{STATUS_LABELS[store.status]}</p>}
      <h2><span className="store-map-number" aria-hidden="true">{index+1}</span><Link href={href}>{store.name}</Link></h2>
      <p className="store-address">{storeAddressLine(store)}</p>
      <StoreMetro store={store} limit={2}/>
      {store.catalog.length>0&&<p className="store-list-stock">
        {covers.length>0&&<span className="store-list-covers" aria-hidden="true">{covers.map((item,i)=><Image key={i} src={item.cover!} width={32} height={32} alt=""/>)}</span>}
        <span>{store.catalog.length} {plural(store.catalog.length,['напиток','напитка','напитков'])}{cheapest!==null&&<> · от <strong>{rub(cheapest)}</strong></>}</span>
      </p>}
      {store.description&&<p className="store-list-description">{store.description}</p>}
      {own&&store.moderationNote&&<p className="store-note">{store.moderationNote}</p>}
    </div>
    <div className="store-card-actions store-list-actions">
      <Link className="community-button" href={href}>Подробнее</Link>
      <a className="community-button community-button-secondary" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Маршрут ↗</a>
      {own&&<Link href={`/market/stores/${store.id}/edit`} className="community-button community-button-secondary">Изменить</Link>}
    </div>
  </article>;
}
const STOCK_ORDER={available:0,unknown:1,unavailable:2} as const;
/** In stock first, then by price; unknown prices go last within their group. */
export function sortStoreCatalog(items:StoreItemView[]){
  return [...items].sort((a,b)=>STOCK_ORDER[a.availability]-STOCK_ORDER[b.availability]||(a.price??Infinity)-(b.price??Infinity)||a.name.localeCompare(b.name,'ru'));
}
/** Body of the store page: photos and prices in the main column, map and metro in a sticky aside. */
export function StoreDetail({store,own,apiKey,map}:{store:StoreView;own:boolean;apiKey:string;map:ReactNode}){
  const cheapest=cheapestPrice(store);const items=sortStoreCatalog(store.catalog);
  const updated=new Date(store.updatedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric'});
  return <article className="store-detail-body">
    <header className="store-detail-head">
      <div>
        {own&&<p className="store-status-chip" data-status={store.status}>{STATUS_LABELS[store.status]}</p>}
        <h1>{store.name}</h1>
        <p className="store-detail-address">{storeAddressLine(store)}</p>
        {store.catalog.length>0&&<p className="store-detail-summary">{store.catalog.length} {plural(store.catalog.length,['напиток','напитка','напитков'])}{cheapest!==null&&<> · от <strong>{rub(cheapest)}</strong></>}</p>}
      </div>
      <div className="store-detail-actions">
        {/* On phones this button floats above the tab bar, so the route is one tap away while scrolling the prices. */}
        <a className="community-button store-route-button" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
          Открыть в Яндекс Картах
        </a>
        {own&&<Link href={`/market/stores/${store.id}/edit`} className="community-button community-button-secondary">Редактировать</Link>}
      </div>
    </header>
    {own&&store.moderationNote&&<p className="store-detail-note" role="note">Комментарий модератора: {store.moderationNote}</p>}
    <div className="store-detail-grid">
      <div className="store-detail-main">
        <StoreGallery photos={store.photos} name={store.name}/>
        {store.description&&<section className="store-detail-section" aria-labelledby="store-about"><h2 id="store-about">О магазине</h2><p className="store-description">{store.description}</p></section>}
        <section className="store-detail-section" aria-labelledby="store-prices">
          <h2 id="store-prices">Напитки и цены{store.catalog.length>0&&<span className="store-detail-count">{store.catalog.length}</span>}</h2>
          {items.length?<ul className="store-price-list">{items.map((item,i)=><li key={i} data-availability={item.availability}>
            <DrinkName item={item}/><strong>{item.price===null?'—':rub(item.price)}</strong>
          </li>)}</ul>:<p className="store-note">Участники пока не добавили напитки этого магазина.</p>}
          <p className="store-note">Обновлено {updated}. Наличие и цену уточняйте в магазине.</p>
        </section>
      </div>
      <aside className="store-detail-aside">
        {store.latitude!==null&&store.longitude!==null&&apiKey?map:null}
        <div className="store-detail-place">
          <h2>Как добраться</h2>
          <StoreMetro store={store} limit={3}/>
          <a className="store-form-link" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах ↗</a>
        </div>
      </aside>
    </div>
  </article>;
}
/** Compact card shown over the map after a click on a store point. */
export function StoreMapPopup({store,index,onClose}:{store:StoreView;index:number;onClose:()=>void}){
  const priced=store.catalog.filter(item=>item.price!==null&&item.availability!=='unavailable').slice(0,3);
  const cheapest=cheapestPrice(store);
  return <section className="store-map-popup" aria-label={`Магазин ${store.name}`} aria-live="polite">
    <button type="button" className="store-map-popup-close" aria-label="Закрыть карточку" onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    <h2><span className="store-map-number" aria-hidden="true">{index+1}</span>{store.name}</h2>
    <p className="store-address">{store.address}</p>
    <StoreMetro store={store} limit={1}/>
    {store.catalog.length>0&&<p className="store-map-popup-stock">{store.catalog.length} {plural(store.catalog.length,['напиток','напитка','напитков'])}{cheapest!==null&&<> · от <strong>{rub(cheapest)}</strong></>}</p>}
    {priced.length>0&&<ul className="store-map-popup-drinks">{priced.map((item,i)=><li key={i}><span>{item.name}</span><strong>{rub(item.price!)}</strong></li>)}</ul>}
    <div className="store-map-popup-actions"><Link className="community-button" href={`/market/stores/${store.id}`}>Подробнее</Link><a className="community-button community-button-secondary" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Маршрут ↗</a></div>
  </section>;
}
function plural(n:number,[one,few,many]:[string,string,string]){const a=n%10,b=n%100;return a===1&&b!==11?one:a>=2&&a<=4&&(b<12||b>14)?few:many;}
