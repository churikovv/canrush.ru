'use client';
import Image from 'next/image';
import { MarketPhotoPicker } from '@/components/market-photo-picker';
import { PhotoDeleteIcon } from '@/components/photo-delete-icon';
import { startTransition, useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import Link from '@/components/navigation-progress';
import { CITIES, findCity } from '@canrush/shared';
import { CoverImage } from '@/components/cover-image';
import { geocodeAddress } from '@/components/store-map';
import { StoreDrinkPicker } from '@/components/store-drink-picker';
import { pluralRu } from '@/lib/drink-calendar-fields';
import { STORE_CATALOG_LIMIT, loadStoreClipboard, pasteStoreItems, readStoreClipboard, subscribeStoreClipboard, type StoreClipboard } from '@/lib/store-clipboard';
import { surviveNetworkError } from '@/lib/network-safe-action';
import { clearStoreDraft, readStoreDraft, writeStoreDraft } from '@/lib/store-draft';
import { presetClipboard, type CopyStoreOption } from '@/lib/store-preset-fields';
import { StoreCopyPicker } from '@/components/store-copy-picker';
import { StoreHuntHint } from '@/components/store-hunt-hint';
import { REMOVE_ICON, StoreTemplates } from '@/components/store-templates';
import { STORE_XP, nearestStations, type LocationSource, type StockStatus } from '@/lib/store-fields';
import type { Store } from '@/lib/stores';
import type { StoreDrinkOption } from '@/lib/store-catalog';
import { geocodeStoreAction, saveStoreAction, scanStorePhotosAction, storeAssortmentAction } from '@/app/market/stores/actions';
import { FormOptional, FormStep } from '@/components/form-step';
import { STORE_SCAN_PHOTOS } from '@/lib/store-photo-fields';
import { FormAlert } from '@/components/form-alert';

type GeoStatus = {kind:'idle'}|{kind:'searching'}|{kind:'found';address:string;precise:boolean}|{kind:'missing'}|{kind:'error'};
interface Row { id: string; name: string; price: string; availability: StockStatus; brand?: string; flavor?: string }
const parse=(value:string)=>Number(value.replace(',','.'));
function validPoint(lat:string,lng:string){const a=parse(lat),b=parse(lng);return lat.trim()&&lng.trim()&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?[a,b] as const:null;}
const STEPS=[{id:'store-step-main',title:'О магазине'},{id:'store-step-photos',title:'Фото'},{id:'store-step-stock',title:'Напитки и цены'}] as const;
const LAST_STEP=STEPS.length-1;
type Field=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const rowsOf=(store?:Store):Row[]=>(store?.catalog??[]).map((item,index)=>({...item,price:item.price===null?'':String(item.price/100),id:String(index)}));
/** Что сравнивать с исходной формой: id строк новые при каждой вставке, а черновик нужен только тогда, когда содержимое другое. */
const draftContent=(name:string,description:string,address:string,items:Row[])=>JSON.stringify([name,description,address,items.map(({name,price,availability,brand,flavor})=>[name,price,availability,brand,flavor])]);
const SPINNER=<span className="store-scan-spinner" aria-hidden="true"/>;
const drinkCount=(count:number)=>`${count} ${pluralRu(count,'напиток','напитка','напитков')}`;
const nearestId=(city:string,point:readonly [number,number]|null)=>point?nearestStations(city,point[0],point[1],1)[0]?.station.id??'':'';

export function StoreForm({title,xp,initial,cityId,apiKey,drinks,geocoder=false,hunt=false,photoRequired=true}:{title:string;xp?:number;photoRequired?:boolean;initial?:Store;cityId:string;apiKey:string;drinks:StoreDrinkOption[];geocoder?:boolean;hunt?:boolean}){
  const [photos,setPhotos]=useState<File[]>([]);
  const [photosBusy,setPhotosBusy]=useState(false);
  const [retained,setRetained]=useState(initial?.photos??[]);
  // Города в форме нет: новый магазин — в городе, выбранном на сайте, правка оставляет город магазина.
  const city=initial?.city??cityId;
  // Управляемые поля: после ответа сервера с ошибкой React очищает форму, и название с описанием пропали бы.
  const [name,setName]=useState(initial?.name??'');
  const [description,setDescription]=useState(initial?.description??'');
  const [address,setAddress]=useState(initial?.address??'');
  const [lat,setLat]=useState(initial?.latitude!=null?String(initial.latitude):'');const [lng,setLng]=useState(initial?.longitude!=null?String(initial.longitude):'');
  const [source,setSource]=useState<LocationSource|''>(initial?.locationSource??'');
  const [geo,setGeo]=useState<GeoStatus>({kind:'idle'});
  const [metro,setMetro]=useState(initial?.metro??'');
  const [items,setItems]=useState<Row[]>(()=>rowsOf(initial));
  const [geoError,setGeoError]=useState('');
  const [photoError,setPhotoError]=useState(false);
  // Напитки с фото ищутся, пока участник идёт дальше: шаг не ждёт нейросеть, а список пополняется сам.
  const [scan,setScan]=useState<{kind:'idle'|'scanning'|'failed'}|{kind:'done';found:number;others:string[];unread:string[]}>({kind:'idle'});
  const scanned=useRef('');
  // Читается только в браузере: на сервере копии нет, поэтому первая отрисовка совпадает с серверной.
  const clipboardRaw=useSyncExternalStore(subscribeStoreClipboard,loadStoreClipboard,()=>null);
  const clipboard=useMemo(()=>readStoreClipboard(clipboardRaw),[clipboardRaw]);
  const [pasted,setPasted]=useState<{source:string;added:number;skipped:number;withPrices:boolean}|null>(null);
  const [copyError,setCopyError]=useState('');
  const [copying,startCopying]=useTransition();
  const templateDrinks=useMemo(()=>items.filter(item=>item.name.trim()).map(({name,brand,flavor})=>({name,...(brand!==undefined?{brand,flavor}:{})})),[items]);
  const [state,action,pending]=useActionState(surviveNetworkError(saveStoreAction.bind(null,initial?.id)),{});
  // One section at a time; all stay mounted so typed values survive. An edited store can jump to any step.
  const [step,setStep]=useState(0);const [reached,setReached]=useState(initial?LAST_STEP:0);
  const formRef=useRef<HTMLFormElement>(null);
  const location=findCity(city)??CITIES[0];
  const point=validPoint(lat,lng);
  const photoCount=photos.length+retained.length;
  const needsPhoto=photoRequired&&!photoCount;
  const taken=useMemo(()=>new Set(items.flatMap(item=>item.brand!==undefined?[JSON.stringify([item.brand,item.flavor])]:[])),[items]);
  const covers=useMemo(()=>new Map(drinks.flatMap(drink=>drink.cover?[[JSON.stringify([drink.brand,drink.flavor]),drink.cover] as const]:[])),[drinks]);
  const busy=pending||photosBusy||geo.kind==='searching';
  const canGeocode=geocoder||Boolean(apiKey);

  const draftId=initial?.id??null;
  const draftVersion=initial?new Date(initial.updatedAt).toISOString():'';
  const [draftBase]=useState(()=>draftContent(initial?.name??'',initial?.description??'',initial?.address??'',rowsOf(initial)));
  const draftChecked=useRef(false);
  const [restored,setRestored]=useState<{savedAt:number;photos:number}|null>(null);
  // Браузера нет на сервере, поэтому черновик возвращается только после монтирования. Фото в нём нет, и без них дальше второго шага не вернуть.
  useEffect(()=>{
    if(draftChecked.current)return;
    const timer=setTimeout(()=>{
      draftChecked.current=true;
      const found=readStoreDraft(draftId,draftVersion);
      if(!found||draftContent(found.name,found.description,found.address,found.items)===draftBase)return;
      setName(found.name);setDescription(found.description);setAddress(found.address);setItems(found.items);
      // Город сменили в шапке: точка другого города не подходит, адрес найдётся заново.
      const sameCity=found.city===city;
      setLat(sameCity?found.latitude:'');setLng(sameCity?found.longitude:'');setSource(sameCity?found.source:'');setMetro(sameCity?found.metro:'');
      const resume=retained.length?found.step:Math.min(found.step,1);
      setStep(resume);setReached(value=>Math.max(value,resume));
      setRestored({savedAt:found.savedAt,photos:found.photos});
    },0);
    return ()=>clearTimeout(timer);
  },[city,draftBase,draftId,draftVersion,retained.length]);
  // Пишем с паузой, пока участник заполняет форму. Вернулись к исходному — черновик не нужен.
  useEffect(()=>{
    if(!draftChecked.current||state.saved)return;
    const timer=setTimeout(()=>{
      if(draftContent(name,description,address,items)===draftBase)clearStoreDraft(draftId);
      else writeStoreDraft(draftId,{version:draftVersion,name,description,address,city,latitude:lat,longitude:lng,source,metro,items,step,photos:photos.length});
    },500);
    return ()=>clearTimeout(timer);
  },[address,city,description,draftBase,draftId,draftVersion,items,lat,lng,metro,name,photos.length,source,state.saved,step]);
  useEffect(()=>{if(state.saved)clearStoreDraft(draftId);},[draftId,state.saved]);
  function dropDraft(){
    clearStoreDraft(draftId);setRestored(null);
    setName(initial?.name??'');setDescription(initial?.description??'');setAddress(initial?.address??'');setItems(rowsOf(initial));
    setLat(initial?.latitude!=null?String(initial.latitude):'');setLng(initial?.longitude!=null?String(initial.longitude):'');setSource(initial?.locationSource??'');setMetro(initial?.metro??'');
    setGeo({kind:'idle'});setStep(0);
  }

  function place(next:readonly [number,number]|null,how:LocationSource|''){
    setLat(next?next[0].toFixed(6):'');setLng(next?next[1].toFixed(6):'');setSource(next?how:'');
    setMetro(nearestId(city,next));
  }
  /** Точку даёт только адрес: она ищется при переходе дальше и перед отправкой. `missing` — такого адреса в этом городе нет, `null` — поиск недоступен. */
  async function locate():Promise<readonly [number,number]|'missing'|null>{
    const query=address.trim();
    if(!canGeocode||query.length<3)return null;
    setGeo({kind:'searching'});
    try{
      // The server geocoder has its own key; without it the Maps JS API key is tried in the browser.
      let result;
      if(geocoder){const answer=await geocodeStoreAction(city,query);if('error' in answer)throw new Error(answer.error);result=answer.result;}
      else result=await geocodeAddress(apiKey,`${location.name}, ${query}`,[location.lat,location.lng]);
      if(!result){setGeo({kind:'missing'});return 'missing';}
      const next=[result.latitude,result.longitude] as const;place(next,'geocoded');setGeo({kind:'found',address:result.address,precise:result.precise});return next;
    }catch{setGeo({kind:'error'});return null;}
  }

  const sections=()=>[...formRef.current?.querySelectorAll<HTMLElement>('section.form-card')??[]];
  function show(next:number){
    setStep(next);setReached(value=>Math.max(value,next));
    requestAnimationFrame(()=>{const section=sections()[next];formRef.current?.scrollIntoView({block:'start',behavior:'smooth'});section?.focus({preventScroll:true});});
  }
  /** Новые фото — новый проход: то же фото второй раз не отправляем. Найденное дополняет список, а не заменяет его. */
  async function scanPhotos(){
    const files=photos.slice(0,STORE_SCAN_PHOTOS);
    const signature=files.map(file=>`${file.name}:${file.size}`).join('|');
    if(!files.length||signature===scanned.current)return;
    scanned.current=signature;setScan({kind:'scanning'});
    const form=new FormData();files.forEach(file=>form.append('photos',file));
    try{
      const result=await scanStorePhotosAction(form);
      if('error' in result){setScan({kind:result.error==='off'?'idle':'failed'});return;}
      setItems(current=>{
        const known=new Set(current.map(item=>JSON.stringify([item.brand,item.flavor])));
        const fresh=result.drinks.filter(drink=>!known.has(JSON.stringify([drink.brand,drink.flavor]))).slice(0,50-current.length);
        return [...current,...fresh.map(drink=>({id:crypto.randomUUID(),price:'',availability:'available' as StockStatus,name:drink.label,brand:drink.brand,flavor:drink.flavor}))];
      });
      setScan({kind:'done',found:result.drinks.length,others:result.others,unread:result.unread});
    }catch{setScan({kind:'failed'});}
  }
  /** Считается по текущему списку внутри обновления: пока шёл запрос, нейросеть могла дописать напитки с фото. */
  function pasteAssortment(source:StoreClipboard,label=`из «${source.store}»`){
    const {added,skipped}=pasteStoreItems(items,source);
    setItems(current=>[...current,...pasteStoreItems(current,source).added.map(item=>({...item,price:item.price===null?'':String(item.price/100),id:crypto.randomUUID()}))]);
    setPasted({source:label,added:added.length,skipped,withPrices:source.withPrices});
    setCopyError('');
  }
  function copyFromStore(store:CopyStoreOption){
    setCopyError('');setPasted(null);
    startCopying(async()=>{
      const source=await storeAssortmentAction(store.id).catch(()=>null);
      if(source)pasteAssortment(source);else setCopyError('Не удалось скопировать этот магазин. Выберите другой.');
    });
  }
  /** Leaving a step forward checks its fields; the address step also looks up the point, the photo step wants a photo. */
  async function advance(target:number){
    if(busy)return;
    if(target>step){
      const invalid=[...sections()[step]?.querySelectorAll<Field>('input,select,textarea')??[]].find(field=>!field.checkValidity());
      if(invalid){invalid.reportValidity();return;}
      // Правка старого магазина не упирается в адрес, который геокодер не знает: магазин остаётся без точки, как был.
      if(step===0&&!point&&await locate()==='missing'&&!initial)return;
      if(step===1){if(needsPhoto){setPhotoError(true);return;}void scanPhotos();}
    }
    show(target);
  }

  if(state.saved&&state.staff)return <section className="market-empty"><h2>Изменения сохранены</h2><p>Магазин остался в своём статусе, правка записана в журнал админки.</p><div className="market-empty-actions"><Link href="/admin/stores" className="community-button">К магазинам в админке</Link>{initial&&<Link href={`/market/stores/${initial.id}`} className="community-button community-button-secondary">Открыть магазин</Link>}</div></section>;
  if(state.saved)return <section className="market-empty"><h2>Магазин отправлен на проверку</h2><p>После модерации он появится в списке и на карте{initial ? '' : <>, а вы получите <strong>+{STORE_XP} XP</strong></>}.</p><div className="market-empty-actions"><Link href="/market/stores?mine=1" className="community-button">Мои магазины</Link></div></section>;
  const optional=<FormOptional/>;
  // Те же цены, что считает триггер охоты: положительная цена и напиток не «нет в наличии».
  const priced=items.filter(item=>Number(item.price)>0&&item.availability!=='unavailable').length;
  const intros=[
    'Название и адрес, по которым магазин найдут покупатели. Точку на карте и метро подберём сами.',
    'Вход, витрина или холодильник — от 1 до 5 фото. Банки на фото нейросеть сама добавит в список, поэтому не снимайте людей и документы.',
    'Выберите энергетики из каталога или впишите свой, неизвестную цену можно оставить пустой. Мы проверим заявку перед публикацией.',
  ];
  return <>
  <header className="store-editor-heading">
    <h1>{title}{xp&&<span className="store-xp-chip" title="Опыт за магазин, который прошёл проверку">+{xp} XP</span>}</h1>
    <div className="store-editor-intro">{intros.map((intro,index)=><p key={intro} data-active={index===step||undefined}>{intro}</p>)}</div>
  </header>
  <form ref={formRef} noValidate onSubmit={event=>{
    // Enter and the main button move forward until the last step; then any invalid field opens its own step.
    if(step<LAST_STEP){event.preventDefault();void advance(step+1);return;}
    if(needsPhoto){event.preventDefault();setPhotoError(true);show(1);return;}
    const invalid=[...event.currentTarget.querySelectorAll<Field>('input,select,textarea')].find(field=>!field.checkValidity());
    if(invalid){event.preventDefault();const index=sections().findIndex(section=>section.contains(invalid));if(index>=0&&index!==step)show(index);setTimeout(()=>invalid.reportValidity());}
  }} action={form=>{
    if(busy)return;photos.forEach(photo=>form.append('photos',photo));
    if(point||!canGeocode){startTransition(()=>action(form));return;}
    // No point yet: geocode the address right before sending; the store may still be saved without a point.
    void locate().then(found=>{
      if(found&&found!=='missing'){form.set('latitude',found[0].toFixed(6));form.set('longitude',found[1].toFixed(6));form.set('locationSource','geocoded');form.set('metro',nearestId(city,found));setGeoError('');}
      else setGeoError('Не удалось найти адрес на карте — магазин сохранится без точки.');
      startTransition(()=>action(form));
    });
  }} className="store-form"><fieldset disabled={pending}>
    {restored&&<FormAlert tone="info" title={`Вернули черновик от ${new Date(restored.savedAt).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}`} actions={<button type="button" className="community-button community-button-secondary" onClick={dropDraft}>Очистить</button>}>{restored.photos>0?'Фото в черновике не сохраняются, добавьте их заново.':undefined}</FormAlert>}
    <p className="store-form-counter" aria-live="polite">Шаг {step+1} из {STEPS.length} · <b>{STEPS[step]!.title}</b></p>
    <ol className="store-form-progress" aria-label="Этапы заявки">{STEPS.map((item,index)=><li key={item.id} data-state={index===step?'current':index<=reached?'visited':'upcoming'}>
      <button type="button" disabled={index>reached} aria-current={index===step?'step':undefined} onClick={()=>{if(index!==step)void advance(index);}}><span className="store-form-progress-label">{index+1}. {item.title}</span></button>
    </li>)}</ol>
    <section className="form-card" aria-labelledby="store-step-main" tabIndex={-1} hidden={step!==0}>
      <FormStep n={1} id="store-step-main" title="О магазине"/>
      <label>Название магазина<input name="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Например, «Энергия у метро»"/></label>
      <label>Адрес<input name="address" required maxLength={300} placeholder="Улица, дом, этаж или павильон" value={address} onChange={e=>{setAddress(e.target.value);if(lat||lng)place(null,'');setGeo({kind:'idle'});}}/></label>
      <p className="store-geo-status" role="status">{geo.kind==='searching'?'Ищем адрес на карте…':geo.kind==='found'?`Точка найдена: ${geo.address}${geo.precise?'':' (примерно)'}`:geo.kind==='missing'?`Адрес не найден в городе ${location.name}. Уточните его${initial?'':' или смените город в шапке сайта'}.`:geo.kind==='error'?'Поиск по адресу сейчас недоступен: магазин сохранится без точки на карте.':initial?'':`Город: ${location.name}. Другой можно выбрать в шапке сайта.`}</p>
      <label><span className="form-label">Описание {optional}</span><textarea name="description" maxLength={1500} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Как найти вход, какие напитки продаются"/></label>
      <input type="hidden" name="city" value={city}/>
      <input type="hidden" name="latitude" value={lat}/>
      <input type="hidden" name="longitude" value={lng}/>
      <input type="hidden" name="locationSource" value={source}/>
      <input type="hidden" name="metro" value={metro}/>
    </section>
    <section className="form-card store-photo-section" aria-labelledby="store-step-photos" tabIndex={-1} hidden={step!==1}>
      <FormStep n={2} id="store-step-photos" title="Фотографии"/>
      {retained.map(id=><input key={id} type="hidden" name="retainedPhoto" value={id}/>)}
      {retained.length>0&&<div className="store-photo-previews">{retained.map((id,index)=><div key={id}><Image src={`/api/store-photos/${id}?size=thumbnail`} alt={`Фото магазина ${index+1}`} width={160} height={160} unoptimized/><button type="button" className="photo-delete-button" aria-label={`Удалить сохранённое фото ${index+1}`} onClick={()=>setRetained(retained.filter(v=>v!==id))}><PhotoDeleteIcon/></button></div>)}</div>}
      <MarketPhotoPicker compact crop={false} maxPhotos={5-retained.length} onChange={setPhotos} onBusyChange={setPhotosBusy} disabled={pending}/>
      {photoError&&needsPhoto&&<FormAlert>Добавьте хотя бы одно фото магазина.</FormAlert>}
    </section>
    <div className="store-stock-step" hidden={step!==2}>
    {items.length<50&&<div className="store-stock-pinned"><label className="sr-only" htmlFor="store-drink-picker">Добавить напиток</label>
      <StoreDrinkPicker id="store-drink-picker" options={drinks} taken={taken} disabled={pending} onAdd={drink=>{
        if(drink.brand===undefined&&items.some(item=>item.brand===undefined&&item.name.toLocaleLowerCase('ru-RU')===drink.name.toLocaleLowerCase('ru-RU')))return;
        setItems([{id:crypto.randomUUID(),price:'',availability:'available',...drink},...items]);
      }}/></div>}
    <section className="form-card" aria-labelledby="store-step-stock" tabIndex={-1}>
      <FormStep n={3} id="store-step-stock" title="Напитки и цены" optional/>
      {scan.kind==='scanning'&&<FormAlert tone="info" icon={SPINNER} title="Ищем напитки на фото">Обычно это занимает несколько секунд, список пополнится сам.</FormAlert>}
      {scan.kind==='failed'&&<FormAlert tone="warning" title="Не получилось разобрать фото">Добавьте напитки через поиск вверху.</FormAlert>}
      {scan.kind==='done'&&<FormAlert tone={scan.found?'success':'info'} title={scan.found?`Нашли на фото: ${drinkCount(scan.found)}`:'Знакомых банок на фото не нашли'}
        actions={scan.others.length>0?scan.others.map(name=><button key={name} type="button" className="store-scan-chip" disabled={items.length>=50} onClick={()=>{
          setItems([{id:crypto.randomUUID(),price:'',availability:'available',name},...items]);
          setScan({...scan,others:scan.others.filter(other=>other!==name)});
        }}>+ {name}</button>):undefined}>
        {[scan.found?'Нейросеть может ошибаться: проверьте список и впишите цены.':'Добавьте напитки через поиск вверху или выберите шаблон.',scan.unread.length>0&&`Вкус не разобрали: ${scan.unread.join(', ')}. Добавьте их вручную.`,scan.others.length>0&&'Нет в каталоге, можно добавить:'].filter(Boolean).join(' ')}
      </FormAlert>}
      <div className="store-quick">
        <span className="store-quick-title">Скопировать из магазина</span>
        <span className="store-quick-title">Шаблоны</span>
        <StoreCopyPicker id="store-copy-picker" city={city} exceptId={initial?.id??null} disabled={pending||copying||items.length>=STORE_CATALOG_LIMIT} onPick={copyFromStore}/>
        <StoreTemplates items={templateDrinks} options={drinks} disabled={pending} onAdd={(name,list)=>pasteAssortment(presetClipboard(name,list),`из шаблона «${name}»`)}/>
        <p>Свой магазин — с ценами, чужой — только напитки.</p>
      </div>
      {!pasted&&clipboard&&clipboard.storeId!==initial?.id&&<FormAlert tone="info" title={`Скопировано из «${clipboard.store}»`} actions={<button type="button" className="community-button community-button-secondary" disabled={items.length>=STORE_CATALOG_LIMIT} onClick={()=>pasteAssortment(clipboard)}>Вставить ассортимент</button>}>
        {drinkCount(clipboard.items.length)}{clipboard.withPrices?' с ценами. Проверьте, что они верны для этого магазина.':' без цен: цены впишете сами.'}
      </FormAlert>}
      {copying&&<FormAlert tone="info" icon={SPINNER} title="Копируем ассортимент"/>}
      {pasted&&(pasted.added
        ?<FormAlert tone="success" title={`Добавили ${drinkCount(pasted.added)} ${pasted.source}`}>{[pasted.skipped>0&&`Уже были в списке или не поместились: ${pasted.skipped}.`,pasted.withPrices?'Проверьте цены: они из другого магазина.':'Впишите цены этого магазина.'].filter(Boolean).join(' ')}</FormAlert>
        :<FormAlert tone="info" title="Новых напитков нет">Все напитки {pasted.source} уже в списке.</FormAlert>)}
      {copyError&&<FormAlert tone="warning">{copyError}</FormAlert>}
      <input type="hidden" name="catalog" value={JSON.stringify(items.map(({name,price,availability,brand,flavor})=>({name,price:price.trim()?Math.round(parse(price)*100):null,availability,...(brand!==undefined?{brand,flavor}:{})})))}/>
      {items.length>0&&<div className="store-stock-editor">{items.map((item,index)=>{
        const cover=item.brand!==undefined?covers.get(JSON.stringify([item.brand,item.flavor])):undefined;
        return <div key={item.id} className="store-stock-row">
          <span className="store-template-cover">{cover?<CoverImage src={cover} width={112} height={112} alt=""/>:<span aria-hidden="true">{item.name.slice(0,1)}</span>}</span>
          {item.brand!==undefined?<span className="store-template-caption" title={item.name}>{item.name}</span>
            :<input aria-label={`Напиток ${index+1}`} required maxLength={150} placeholder="Название" value={item.name} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,name:e.target.value}:v))}/>}
          <input type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" aria-label={`Цена напитка ${index+1}`} placeholder="Цена, ₽" value={item.price} onChange={e=>setItems(items.map(v=>v.id===item.id?{...v,price:e.target.value}:v))}/>
          <button type="button" className="store-template-remove" aria-label={`Удалить напиток ${index+1}`} onClick={()=>setItems(items.filter(v=>v.id!==item.id))}><span>{REMOVE_ICON}</span></button>
        </div>;
      })}</div>}
      {items.length>=50&&<p className="store-note">Добавлено максимум — 50 напитков.</p>}
    </section>
    </div>
    {hunt&&step===LAST_STEP&&<StoreHuntHint photo={photoCount>0} point={point!==null} prices={priced} isNew={!initial}/>}
    <div className="form-submit store-form-footer">
      {initial&&step===LAST_STEP&&<p>После изменения магазин снова пройдёт модерацию и временно исчезнет из публичного списка.</p>}
      {geoError&&<p className="store-note" role="status">{geoError}</p>}
      {state.error&&<FormAlert>{state.error}</FormAlert>}
      <div className="store-form-nav">
        {step>0&&<button type="button" className="community-button community-button-secondary" disabled={busy} onClick={()=>show(step-1)}>Назад</button>}
        <button className="community-button" disabled={busy} type="submit">{pending?'Отправляем…':geo.kind==='searching'?'Ищем адрес…':step<LAST_STEP?'Далее':'Отправить на проверку'}</button>
      </div>
    </div>
  </fieldset></form>
  </>;
}
