'use client';
import Image from 'next/image';
import { MarketPhotoPicker } from '@/components/market-photo-picker';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { useActionState, useState } from 'react';
import Link from '@/components/navigation-progress';
import { CITIES, findCity } from '@canrush/shared';
import { PriceFilterInput } from '@/components/price-filter-input';
import { StoreMap } from '@/components/store-map';
import { METRO, STOCK_LABELS, type StockStatus } from '@/lib/store-fields';
import type { Store } from '@/lib/stores';
import { saveStoreAction } from '@/app/market/stores/actions';
export function StoreForm({initial,cityId,apiKey}:{initial?:Store;cityId:string;apiKey:string}){
  const [photos,setPhotos]=useState<File[]>([]);
  const [photosBusy,setPhotosBusy]=useState(false);
  const [retained,setRetained]=useState(initial?.photos??[]);
  const [city,setCity]=useState(initial?.city??cityId);const [metro,setMetro]=useState(initial?.metro??'');
  const [lat,setLat]=useState(initial?String(initial.latitude):'');const [lng,setLng]=useState(initial?String(initial.longitude):'');
  const [items,setItems]=useState((initial?.catalog??[]).map((item,index)=>({...item,price:item.price===null?'':String(item.price/100),id:String(index)})));
  const [state,action,pending]=useActionState(saveStoreAction.bind(null,initial?.id),{});
  const location=findCity(city)??CITIES[0];
  const latitude=Number(lat.replace(',','.')),longitude=Number(lng.replace(',','.'));
  const points=lat&&lng&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180?[{id:'new',latitude,longitude}]:[];
  if(state.saved)return <section className="market-empty"><h2>Магазин отправлен на проверку</h2><p>После модерации он появится в списке и на карте.</p><Link href="/market/stores?mine=1" className="community-button">Мои магазины</Link></section>;
  return <form action={form=>{if(photosBusy)return;photos.forEach(photo=>form.append('photos',photo));action(form);}} className="store-form"><fieldset disabled={pending}>
    <label>Название магазина<input name="name" required maxLength={120} defaultValue={initial?.name}/></label>
    <section className="store-photo-section"><h2>Фотографии · необязательно</h2>
      {retained.map(id=><input key={id} type="hidden" name="retainedPhoto" value={id}/>)}
      {retained.length>0&&<div className="store-photo-previews">{retained.map((id,index)=><div key={id}><Image src={`/api/store-photos/${id}?size=thumbnail`} alt={`Фото магазина ${index+1}`} width={160} height={160} unoptimized/><button type="button" className="photo-delete-button" aria-label={`Удалить сохранённое фото ${index+1}`} onClick={()=>setRetained(retained.filter(v=>v!==id))}><PhotoDeleteIcon/></button></div>)}</div>}
      <MarketPhotoPicker compact crop={false} maxPhotos={5-retained.length} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending}/>
    </section>
    <div className="store-form-grid"><label>Город<select aria-label="Город" name="city" value={city} onChange={e=>{setCity(e.target.value);setMetro('');setLat('');setLng('');}}>{CITIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Адрес<input name="address" required maxLength={300} placeholder="Улица, дом, этаж или павильон" defaultValue={initial?.address}/></label></div>
    {(METRO[city]?.length??0)>0&&<div><label htmlFor="store-metro">Ближайшее метро · необязательно</label><PriceFilterInput id="store-metro" value={metro} onChange={setMetro} allLabel="Не указано" options={METRO[city]!.map(s=>({value:s.id,label:`${s.name} · ${s.line}`,color:s.color}))}/></div>}
    <input type="hidden" name="metro" value={metro}/>
    <div><h2>Точка на карте</h2><p>{apiKey?'Нажмите на карту в месте входа в магазин.':'Укажите координаты входа в магазин. Их можно скопировать из ссылки или карточки места в картах.'}</p>
    {apiKey&&<StoreMap apiKey={apiKey} center={[location.lat,location.lng]} points={points} onPick={(a,b)=>{setLat(a.toFixed(6));setLng(b.toFixed(6));}}/>}
    <div className="store-form-grid"><label>Широта<input name="latitude" inputMode="decimal" required value={lat} onChange={e=>setLat(e.target.value)} placeholder={String(location.lat)}/></label><label>Долгота<input name="longitude" inputMode="decimal" required value={lng} onChange={e=>setLng(e.target.value)} placeholder={String(location.lng)}/></label></div>
    <a href={`https://yandex.ru/maps/?ll=${location.lng},${location.lat}&z=12`} target="_blank" rel="noopener noreferrer">Открыть карту города ↗</a></div>
    <label>Описание · необязательно<textarea name="description" maxLength={1500} rows={3} defaultValue={initial?.description} placeholder="Как найти вход, какие напитки продаются"/></label>
    <section><h2>Напитки и цены · необязательно</h2><p>Добавьте известные позиции. Неизвестную цену можно оставить пустой.</p>
      <input type="hidden" name="catalog" value={JSON.stringify(items.map(({name,price,availability})=>({name,price:price.trim()?Math.round(Number(price.replace(',','.'))*100):null,availability})))}/>
      <div className="store-stock-editor">{items.map((item,index)=><div key={item.id} className="store-stock-row"><label>Напиток<input aria-label={`Напиток ${index+1}`} required maxLength={150} value={item.name} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,name:e.target.value}:v))}/></label><label>Цена, ₽<input type="number" min="0.01" max="1000000" step="0.01" value={item.price} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,price:e.target.value}:v))}/></label><label>Наличие<select aria-label="Наличие" value={item.availability} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,availability:e.target.value as StockStatus}:v))}>{Object.entries(STOCK_LABELS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><button type="button" className="community-button community-button-secondary" aria-label={`Удалить напиток ${index+1}`} onClick={()=>setItems(items.filter(v=>v.id!==item.id))}><PhotoDeleteIcon/></button></div>)}</div>
      <button type="button" className="community-button community-button-secondary" disabled={items.length>=50} onClick={()=>setItems([...items,{id:crypto.randomUUID(),name:'',price:'',availability:'unknown'}])}>Добавить напиток</button>
    </section>
    {initial&&<p>После изменения магазин снова пройдёт модерацию и временно исчезнет из публичного списка.</p>}
    {state.error&&<p className="field-error" role="alert">{state.error}</p>}
    <button className="community-button" disabled={pending||photosBusy} type="submit">{pending?'Отправляем…':'Отправить на проверку'}</button>
  </fieldset></form>;
}
