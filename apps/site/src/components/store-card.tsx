import Image from 'next/image';
import Link from '@/components/navigation-progress';
import { findCity } from '@canrush/shared';
import { METRO, STOCK_LABELS, storeMapUrl } from '@/lib/store-fields';
import type { Store } from '@/lib/stores';
export function StoreCard({store,own=false,index}:{store:Store;own?:boolean;index?:number}){
 const station=METRO[store.city]?.find(s=>s.id===store.metro);
 return <article className="store-card" id={`store-${store.id}`} tabIndex={-1}>
  <h2>{index!==undefined&&<span className="store-map-number" aria-hidden="true">{index+1}</span>}{store.name}</h2>
  <p>{findCity(store.city)?.name} · {store.address}</p>{station&&<p className="store-metro">Ⓜ {station.name} · {station.line}</p>}
  {store.photos.length>0&&<div className="store-photo-gallery">{store.photos.map((id,index)=><a key={id} href={`/api/store-photos/${id}`} target="_blank" rel="noopener noreferrer" aria-label={`Открыть фото магазина ${index+1}`}><Image src={`/api/store-photos/${id}?size=thumbnail`} width={240} height={160} alt={`${store.name}, фото ${index+1}`} unoptimized/></a>)}</div>}
  {store.description&&<p className="store-description">{store.description}</p>}
  {own&&<p className="store-status">{{pending:'На проверке',published:'Опубликован',rejected:'Нужны исправления'}[store.status]}{store.moderationNote&&`: ${store.moderationNote}`}</p>}
  {store.catalog.length>0&&<details><summary>Напитки и цены · {store.catalog.length}</summary><ul className="store-stock-list">{store.catalog.map((item,i)=><li key={i}><span>{item.name}<small>{STOCK_LABELS[item.availability]}</small></span><strong>{item.price===null?'Цена не указана':new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(item.price/100)}</strong></li>)}</ul><p className="store-note">Обновлено {new Date(store.updatedAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'})}. Наличие и цену уточняйте в магазине.</p></details>}
  <div className="store-card-actions"><a className="community-button community-button-secondary" href={storeMapUrl(store)} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах ↗</a>{own&&<Link href={`/market/stores/${store.id}/edit`} className="community-button community-button-secondary">Редактировать</Link>}</div>
 </article>;
}
