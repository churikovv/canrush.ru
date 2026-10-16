import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { findCity } from '@canrush/shared';
import { METRO, STOCK_LABELS, formatDistance, nearestStations, storeMapUrl, type MetroStation } from '@/lib/store-fields';
import type { StoreItemView, StoreView } from '@/lib/store-catalog';

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
export function StoreCard({store,own=false,index,detail=false}:{store:StoreView;own?:boolean;index?:number;detail?:boolean}){
 return <article className="store-card" id={`store-${store.id}`} tabIndex={-1}>
  <h2>{index!==undefined&&<span className="store-map-number" aria-hidden="true">{index+1}</span>}{detail?store.name:<Link href={`/market/stores/${store.id}`}>{store.name}</Link>}</h2>
  <p className="store-address">{findCity(store.city)?.name} · {store.address}</p>
  <StoreMetro store={store} limit={detail?3:2}/>
  {store.photos.length>0&&<div className="store-photo-gallery">{store.photos.map((id,index)=><a key={id} href={`/api/store-photos/${id}`} target="_blank" rel="noopener noreferrer" aria-label={`Открыть фото магазина ${index+1}`}><Image src={`/api/store-photos/${id}?size=thumbnail`} width={240} height={160} alt={`${store.name}, фото ${index+1}`} unoptimized/></a>)}</div>}
  {store.description&&<p className="store-description">{store.description}</p>}
  {own&&<p className="store-status">{{pending:'На проверке',published:'Опубликован',rejected:'Нужны исправления'}[store.status]}{store.moderationNote&&`: ${store.moderationNote}`}</p>}
  {store.catalog.length>0&&<details open={detail}><summary>Напитки и цены · {store.catalog.length}</summary><ul className="store-stock-list">{store.catalog.map((item,i)=><li key={i}><DrinkName item={item}/><strong>{item.price===null?'Цена не указана':rub(item.price)}</strong></li>)}</ul><p className="store-note">Обновлено {new Date(store.updatedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})}. Наличие и цену уточняйте в магазине.</p></details>}
  <div className="store-card-actions"><a className="community-button community-button-secondary" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах ↗</a>{own&&<Link href={`/market/stores/${store.id}/edit`} className="community-button community-button-secondary">Редактировать</Link>}</div>
 </article>;
}
/** Compact card shown over the map after a click on a store point. */
export function StoreMapPopup({store,index,onClose}:{store:StoreView;index:number;onClose:()=>void}){
  const priced=store.catalog.filter(item=>item.price!==null&&item.availability!=='unavailable').slice(0,3);
  const cheapest=store.catalog.reduce<number|null>((min,item)=>item.price!==null&&item.availability!=='unavailable'&&(min===null||item.price<min)?item.price:min,null);
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
