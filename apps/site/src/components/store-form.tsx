'use client';
import Image from 'next/image';
import { MarketPhotoPicker } from '@/components/market-photo-picker';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { startTransition, useActionState, useMemo, useRef, useState } from 'react';
import Link from '@/components/navigation-progress';
import { CITIES, findCity } from '@canrush/shared';
import { PriceFilterInput } from '@/components/price-filter-input';
import { StoreMap, geocodeAddress } from '@/components/store-map';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { METRO, STOCK_LABELS, formatDistance, nearestStations, type LocationSource, type StockStatus } from '@/lib/store-fields';
import type { Store } from '@/lib/stores';
import type { StoreDrinkOption } from '@/lib/store-catalog';
import { saveStoreAction } from '@/app/market/stores/actions';
import { FormOptional, FormStep } from '@/components/form-step';

type GeoStatus = {kind:'idle'}|{kind:'searching'}|{kind:'found';address:string;precise:boolean}|{kind:'missing'}|{kind:'error'};
interface Row { id: string; name: string; price: string; availability: StockStatus; brand?: string; flavor?: string }
const parse=(value:string)=>Number(value.replace(',','.'));
function validPoint(lat:string,lng:string){const a=parse(lat),b=parse(lng);return lat.trim()&&lng.trim()&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?[a,b] as const:null;}
const nearestId=(city:string,point:readonly [number,number]|null)=>point?nearestStations(city,point[0],point[1],1)[0]?.station.id??'':'';

export function StoreForm({initial,cityId,apiKey,drinks}:{initial?:Store;cityId:string;apiKey:string;drinks:StoreDrinkOption[]}){
  const [photos,setPhotos]=useState<File[]>([]);
  const [photosBusy,setPhotosBusy]=useState(false);
  const [retained,setRetained]=useState(initial?.photos??[]);
  const [city,setCity]=useState(initial?.city??cityId);
  const [address,setAddress]=useState(initial?.address??'');
  const [lat,setLat]=useState(initial?.latitude!=null?String(initial.latitude):'');const [lng,setLng]=useState(initial?.longitude!=null?String(initial.longitude):'');
  const [source,setSource]=useState<LocationSource|''>(initial?.locationSource??'');
  const [geo,setGeo]=useState<GeoStatus>({kind:'idle'});
  const geocoded=useRef(initial?.locationSource==='geocoded'?`${initial.city}|${initial.address}`:'');
  const initialPoint=initial?.latitude!=null&&initial.longitude!=null?[initial.latitude,initial.longitude] as const:null;
  const [metro,setMetro]=useState(initial?.metro??'');
  // A station equal to the automatic choice keeps following the point; a different one was picked by hand.
  const [metroManual,setMetroManual]=useState(Boolean(initial?.metro)&&initial?.metro!==nearestId(initial?.city??'',initialPoint));
  const [items,setItems]=useState<Row[]>((initial?.catalog??[]).map((item,index)=>({...item,price:item.price===null?'':String(item.price/100),id:String(index)})));
  const [geoError,setGeoError]=useState('');
  const [state,action,pending]=useActionState(saveStoreAction.bind(null,initial?.id),{});
  const location=findCity(city)??CITIES[0];
  const point=validPoint(lat,lng);
  const points=point?[{id:'new',latitude:point[0],longitude:point[1],label:''}]:[];
  const nearby=point?nearestStations(city,point[0],point[1],3):[];
  const taken=useMemo(()=>new Set(items.flatMap(item=>item.brand!==undefined?[JSON.stringify([item.brand,item.flavor])]:[])),[items]);
  const busy=pending||photosBusy||geo.kind==='searching';

  function place(next:readonly [number,number]|null,how:LocationSource|''){
    setLat(next?next[0].toFixed(6):'');setLng(next?next[1].toFixed(6):'');setSource(next?how:'');
    if(!metroManual)setMetro(nearestId(city,next));
  }
  async function locate(force=false):Promise<readonly [number,number]|null>{
    const query=address.trim();const key=`${city}|${query}`;
    if(!apiKey||query.length<3||(source==='manual'&&!force)||(!force&&geocoded.current===key))return null;
    geocoded.current=key;setGeo({kind:'searching'});
    try{
      const result=await geocodeAddress(apiKey,`${location.name}, ${query}`,[location.lat,location.lng]);
      if(!result){setGeo({kind:'missing'});return null;}
      const next=[result.latitude,result.longitude] as const;place(next,'geocoded');setGeo({kind:'found',address:result.address,precise:result.precise});return next;
    }catch{geocoded.current='';setGeo({kind:'error'});return null;}
  }

  if(state.saved)return <section className="market-empty"><h2>Магазин отправлен на проверку</h2><p>После модерации он появится в списке и на карте.</p><div className="market-empty-actions"><Link href="/market/stores?mine=1" className="community-button">Мои магазины</Link></div></section>;
  const optional=<FormOptional/>;
  return <form action={form=>{
    if(busy)return;photos.forEach(photo=>form.append('photos',photo));
    if(point||!apiKey){startTransition(()=>action(form));return;}
    // No point yet: geocode the address right before sending; the store may still be saved without a point.
    void locate(true).then(found=>{
      if(found){form.set('latitude',found[0].toFixed(6));form.set('longitude',found[1].toFixed(6));form.set('locationSource','geocoded');if(!metroManual)form.set('metro',nearestId(city,found));setGeoError('');}
      else setGeoError('Не удалось найти адрес на карте — магазин сохранится без точки. Можно поставить её вручную.');
      startTransition(()=>action(form));
    });
  }} className="store-form"><fieldset disabled={pending}>
    <section className="form-card" aria-labelledby="store-step-main">
      <FormStep n={1} id="store-step-main" title="О магазине" hint="Название и адрес, по которым его найдут покупатели. Точку на карте найдём по адресу."/>
      <label>Название магазина<input name="name" required maxLength={120} defaultValue={initial?.name} placeholder="Например, «Энергия у метро»"/></label>
      <div className="store-form-grid store-address-grid"><label>Город<select aria-label="Город" name="city" value={city} onChange={e=>{setCity(e.target.value);setMetro('');setMetroManual(false);setLat('');setLng('');setSource('');setGeo({kind:'idle'});geocoded.current='';}}>{CITIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Адрес<span className="store-address-field"><input name="address" required maxLength={300} placeholder="Улица, дом, этаж или павильон" value={address} onChange={e=>setAddress(e.target.value)} onBlur={()=>{void locate();}}/>
        {apiKey&&<button type="button" className="community-button community-button-secondary" disabled={busy||address.trim().length<3} onClick={()=>{void locate(true);}}>Найти на карте</button>}</span></label></div>
      <p className="store-geo-status" role="status">{geo.kind==='searching'?'Ищем адрес на карте…':geo.kind==='found'?`Точка найдена: ${geo.address}${geo.precise?'':' (примерно — уточните на карте)'}`:geo.kind==='missing'?'Адрес не найден на карте. Уточните его или поставьте точку вручную.':geo.kind==='error'?'Поиск по адресу сейчас недоступен. Нажмите на карту в месте входа или укажите координаты.':source==='manual'?'Точка указана вручную — она приоритетнее адреса.':''}</p>
      <label><span className="form-label">Описание {optional}</span><textarea name="description" maxLength={1500} rows={3} defaultValue={initial?.description} placeholder="Как найти вход, какие напитки продаются"/></label>
    </section>
    <section className="form-card" aria-labelledby="store-step-map">
      <FormStep n={2} id="store-step-map" title="Точка и метро" hint={apiKey?'Проверьте точку: если вход в другом месте, нажмите на карту.':'Карта недоступна — укажите координаты вручную или оставьте их пустыми.'} optional/>
      {apiKey&&<StoreMap apiKey={apiKey} center={[location.lat,location.lng]} points={points} onPick={(a,b)=>place([a,b],'manual')}/>}
      <input type="hidden" name="locationSource" value={source}/>
      <details className="store-coordinates" open={!apiKey||source==='manual'}><summary>Координаты вручную</summary>
        <div className="store-form-grid"><label>Широта<input name="latitude" inputMode="decimal" value={lat} onChange={e=>{setLat(e.target.value);setSource('manual');const next=validPoint(e.target.value,lng);if(!metroManual)setMetro(nearestId(city,next));}} placeholder={String(location.lat)}/></label><label>Долгота<input name="longitude" inputMode="decimal" value={lng} onChange={e=>{setLng(e.target.value);setSource('manual');const next=validPoint(lat,e.target.value);if(!metroManual)setMetro(nearestId(city,next));}} placeholder={String(location.lng)}/></label></div>
        <div className="store-coordinates-actions">{source==='manual'&&apiKey&&<button type="button" className="store-form-link" onClick={()=>{setSource('');void locate(true);}}>Найти точку по адресу</button>}{point&&<button type="button" className="store-form-link" onClick={()=>place(null,'')}>Убрать точку</button>}<a className="store-form-link" href={`https://yandex.ru/maps/?ll=${location.lng},${location.lat}&z=12`} target="_blank" rel="noopener noreferrer">Открыть карту города ↗</a></div>
      </details>
      {(METRO[city]?.length??0)>0&&<div className="form-field"><label htmlFor="store-metro"><span className="form-label">Ближайшая станция метро, МЦК или МЦД {optional}</span></label><PriceFilterInput id="store-metro" value={metro} onChange={value=>{setMetro(value||nearestId(city,point));setMetroManual(Boolean(value));}} allLabel={point?'Определить автоматически':'Не указано'} options={METRO[city]!.map(s=>({value:s.id,label:`${s.name} · ${s.line}`,color:s.color}))}/>
        {nearby.length>0&&<p className="store-metro-suggest">Рядом: {nearby.map(({station,km},index)=><span key={station.id}>{index>0&&', '}<button type="button" className="store-form-link" aria-pressed={metro===station.id} onClick={()=>{setMetro(station.id);setMetroManual(true);}}><span className="metro-line-dot" style={{backgroundColor:station.color}} aria-hidden="true"/>{station.name} · {formatDistance(km)}</button></span>)}</p>}
      </div>}
      <input type="hidden" name="metro" value={metro}/>
    </section>
    <section className="form-card store-photo-section" aria-labelledby="store-step-photos">
      <FormStep n={3} id="store-step-photos" title="Фотографии" hint="Вход, витрина или холодильник с напитками — до 5 фото." optional/>
      {retained.map(id=><input key={id} type="hidden" name="retainedPhoto" value={id}/>)}
      {retained.length>0&&<div className="store-photo-previews">{retained.map((id,index)=><div key={id}><Image src={`/api/store-photos/${id}?size=thumbnail`} alt={`Фото магазина ${index+1}`} width={160} height={160} unoptimized/><button type="button" className="photo-delete-button" aria-label={`Удалить сохранённое фото ${index+1}`} onClick={()=>setRetained(retained.filter(v=>v!==id))}><PhotoDeleteIcon/></button></div>)}</div>}
      <MarketPhotoPicker compact crop={false} maxPhotos={5-retained.length} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending}/>
    </section>
    <section className="form-card" aria-labelledby="store-step-stock">
      <FormStep n={4} id="store-step-stock" title="Напитки и цены" hint="Выберите энергетики из каталога или впишите свой. Неизвестную цену можно оставить пустой." optional/>
      <input type="hidden" name="catalog" value={JSON.stringify(items.map(({name,price,availability,brand,flavor})=>({name,price:price.trim()?Math.round(parse(price)*100):null,availability,...(brand!==undefined?{brand,flavor}:{})})))}/>
      {items.length>0&&<div className="store-stock-editor">{items.map((item,index)=><div key={item.id} className="store-stock-row">
        {item.brand!==undefined?<div className="store-stock-drink"><span className="form-label">Напиток</span><p>{item.name}<small>Из каталога</small></p></div>
          :<label>Свой напиток<input aria-label={`Напиток ${index+1}`} required maxLength={150} value={item.name} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,name:e.target.value}:v))}/></label>}
        <label>Цена, ₽<input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" aria-label={`Цена напитка ${index+1}`} value={item.price} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,price:e.target.value}:v))}/></label>
        <label>Наличие<select aria-label={`Наличие напитка ${index+1}`} value={item.availability} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,availability:e.target.value as StockStatus}:v))}>{Object.entries(STOCK_LABELS).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
        <button type="button" className="store-stock-remove" aria-label={`Удалить напиток ${index+1}`} onClick={()=>setItems(items.filter(v=>v.id!==item.id))}><PhotoDeleteIcon/></button></div>)}</div>}
      {items.length<50?<div className="form-field"><label htmlFor="store-drink-picker"><span className="form-label">Добавить напиток</span></label>
        <StoreDrinkPicker id="store-drink-picker" options={drinks} taken={taken} disabled={pending} onAdd={drink=>{
          if(drink.brand===undefined&&items.some(item=>item.brand===undefined&&item.name.toLocaleLowerCase('ru-RU')===drink.name.toLocaleLowerCase('ru-RU')))return;
          setItems([...items,{id:crypto.randomUUID(),price:'',availability:'available',...drink}]);
        }}/></div>:<p className="store-note">Добавлено максимум — 50 напитков.</p>}
    </section>
    <div className="form-submit">
      {initial&&<p>После изменения магазин снова пройдёт модерацию и временно исчезнет из публичного списка.</p>}
      {geoError&&<p className="store-note" role="status">{geoError}</p>}
      {state.error&&<p className="field-error" role="alert">{state.error}</p>}
      <button className="community-button" disabled={busy} type="submit">{pending?'Отправляем…':geo.kind==='searching'?'Ищем адрес…':'Отправить на проверку'}</button>
    </div>
  </fieldset></form>;
}
