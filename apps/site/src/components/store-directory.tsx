'use client';
import { useState } from 'react';
import { StoreMap } from './store-map';
import { StoreCard, StoreMapPopup } from './store-card';
import type { StoreView } from '@/lib/store-catalog';
export function StoreDirectory({stores,center,apiKey,own}:{stores:StoreView[];center:[number,number];apiKey:string;own:boolean}){
 const [mode,setMode]=useState<'list'|'map'>('list');const [selected,setSelected]=useState<string|null>(null);
 const item=stores.find(s=>s.id===selected);
 const points=stores.flatMap((s,i)=>s.latitude!==null&&s.longitude!==null?[{id:s.id,latitude:s.latitude,longitude:s.longitude,label:String(i+1)}]:[]);
 const hidden=stores.length-points.length;
 return <><div className="store-view-toolbar"><span>{stores.length ? `Магазинов на странице: ${stores.length}`:'Магазины'} </span><div role="group" aria-label="Вид магазинов">
  <button type="button" title="Списком" aria-label="Списком" aria-pressed={mode==='list'} onClick={()=>setMode('list')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1"/></svg></button>
  <button type="button" title="На карте" aria-label="На карте" aria-pressed={mode==='map'} onClick={()=>setMode('map')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16m6-14v16"/></svg></button>
 </div></div>
 {mode==='map'&&<><StoreMap apiKey={apiKey} center={center} points={points} selected={selected} onSelect={setSelected}>{item&&<StoreMapPopup store={item} index={stores.indexOf(item)} onClose={()=>setSelected(null)}/>}</StoreMap>
  <p className="store-note">На карте показаны магазины текущей страницы. Нажмите на точку, чтобы увидеть адрес, метро и цены.{hidden>0&&` Без точки на карте: ${hidden} — они есть в списке.`}</p></>}
 {mode==='list'&&<div className="store-grid">{stores.map((s,i)=><StoreCard key={s.id} store={s} index={i} own={own}/>)}</div>}
 </>;
}
