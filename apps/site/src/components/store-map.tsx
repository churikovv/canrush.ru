'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
interface Event { get(name:string): number[] }
interface Placemark { events:{add(name:string,callback:()=>void):void}; options:{set(name:string,value:unknown):void} }
interface MapObject { geoObjects: {add(object:unknown):void}; events:{add(name:string,callback:(event:Event)=>void):void}; destroy():void; setBounds(bounds:number[][],options:object):void; panTo(center:number[],options?:object):Promise<void> }
interface GeoObject { geometry:{getCoordinates():number[]}; getAddressLine?():string; properties:{get(name:string):unknown} }
interface Ymaps { ready(callback:()=>void):void; Map:new(element:HTMLElement,options:object)=>MapObject; Placemark:new(coords:number[],properties:object,options?:object)=>Placemark; geocode(request:string,options?:object):Promise<{geoObjects:{get(index:number):GeoObject|undefined}}> }
declare global { interface Window { ymaps?:Ymaps } }
let loading: Promise<Ymaps>|null=null;
function loadMaps(key:string){
  if(!loading)loading=new Promise<Ymaps>((resolve,reject)=>{
    const ready=()=>window.ymaps?.ready(()=>resolve(window.ymaps!));
    if(window.ymaps){ready();return;}
    const script=document.createElement('script');
    const nonce=document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce??'';
    if(nonce)script.nonce=nonce;
    const timer=setTimeout(()=>{script.remove();reject(new Error('timeout'));},15000);
    script.src=`https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU&coordorder=latlong&csp=true${nonce?`&csp[style_nonce]=${encodeURIComponent(nonce)}`:''}`;
    script.onload=()=>{clearTimeout(timer);if(window.ymaps)ready();else reject(new Error('missing API'));};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('load'));};document.head.append(script);
  }).catch(error=>{loading=null;throw error;});
  return loading;
}
export interface GeocodeResult {latitude:number;longitude:number;address:string;precise:boolean}
/** Geocoding through the already loaded Maps JS API: same key and CSP as the map, no server secret. */
export async function geocodeAddress(apiKey:string,query:string,center:[number,number]):Promise<GeocodeResult|null>{
  if(!apiKey||!query.trim())return null;
  const api=await loadMaps(apiKey);
  const result=await api.geocode(query,{results:1,boundedBy:[[center[0]-0.7,center[1]-1.2],[center[0]+0.7,center[1]+1.2]]});
  const item=result.geoObjects.get(0);if(!item)return null;
  const [latitude,longitude]=item.geometry.getCoordinates();if(latitude===undefined||longitude===undefined)return null;
  const meta=item.properties.get('metaDataProperty') as {GeocoderMetaData?:{precision?:string}}|undefined;
  return {latitude,longitude,address:item.getAddressLine?.()??String(item.properties.get('text')??''),precise:['exact','number','near'].includes(meta?.GeocoderMetaData?.precision??'')};
}
export interface StoreMapPoint {id:string;latitude:number;longitude:number;label?:string}
export function StoreMap({apiKey,center,points,selected,onPick,onSelect,children}:{apiKey:string;center:[number,number];points:StoreMapPoint[];selected?:string|null;onPick?:(lat:number,lng:number)=>void;onSelect?:(id:string)=>void;children?:ReactNode}){
  const node=useRef<HTMLDivElement>(null);const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const callbacks=useRef({onPick,onSelect});useEffect(()=>{callbacks.current={onPick,onSelect};},[onPick,onSelect]);
  const marks=useRef(new Map<string,Placemark>());const mapRef=useRef<MapObject|null>(null);
  const serialized=JSON.stringify({center,points});
  useEffect(()=>{
    if(!apiKey)return;
    let cancelled=false,map:MapObject|undefined;const placed=marks.current;
    const data=JSON.parse(serialized) as {center:[number,number];points:StoreMapPoint[]};
    loadMaps(apiKey).then(api=>{
      if(cancelled||!node.current)return;
      map=new api.Map(node.current,{center:data.points.length===1?[data.points[0]!.latitude,data.points[0]!.longitude]:data.center,zoom:data.points.length===1?16:11,controls:['zoomControl','fullscreenControl']});
      mapRef.current=map;placed.clear();
      data.points.forEach((point,index)=>{
        const mark=new api.Placemark([point.latitude,point.longitude],{iconContent:point.label??String(index+1)},{preset:'islands#blueCircleIcon'});
        mark.events.add('click',()=>callbacks.current.onSelect?.(point.id));map!.geoObjects.add(mark);placed.set(point.id,mark);
      });
      if(data.points.length>1){const lat=data.points.map(p=>p.latitude),lng=data.points.map(p=>p.longitude);map.setBounds([[Math.min(...lat),Math.min(...lng)],[Math.max(...lat),Math.max(...lng)]],{checkZoomRange:true,zoomMargin:40});}
      map.events.add('click',event=>{const coords=event.get('coords');if(coords.length===2)callbacks.current.onPick?.(coords[0]!,coords[1]!);});setStatus('ready');
    }).catch(()=>{if(!cancelled)setStatus('error');});
    return()=>{cancelled=true;mapRef.current=null;placed.clear();map?.destroy();};
  },[apiKey,serialized]);
  useEffect(()=>{
    if(status!=='ready')return;
    for(const [id,mark] of marks.current)mark.options.set('preset',id===selected?'islands#redCircleIcon':'islands#blueCircleIcon');
    const {points}=JSON.parse(serialized) as {points:StoreMapPoint[]};const point=points.find(p=>p.id===selected);
    if(point&&points.length>1)void mapRef.current?.panTo([point.latitude,point.longitude],{flying:true}).catch(()=>{});
  },[selected,status,serialized]);
  if(!apiKey)return <div className="store-map-message">Карта пока недоступна. Адреса магазинов доступны в списке и по кнопке «Открыть в Яндекс Картах».</div>;
  return <div className="store-map-shell"><div ref={node} className="store-map" aria-label="Карта магазинов"/>{status!=='ready'&&<p className="store-map-message" role="status">{status==='error'?'Не удалось загрузить карту. Воспользуйтесь списком магазинов.':'Загружаем карту…'}</p>}{children}</div>;
}
