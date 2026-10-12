'use client';
import { useEffect, useRef, useState } from 'react';
interface Event { get(name:string): number[] }
interface MapObject { geoObjects: {add(object:unknown):void}; events:{add(name:string,callback:(event:Event)=>void):void}; destroy():void; setBounds(bounds:number[][],options:object):void }
interface Ymaps { ready(callback:()=>void):void; Map:new(element:HTMLElement,options:object)=>MapObject; Placemark:new(coords:number[],properties:object,options?:object)=>{events:{add(name:string,callback:()=>void):void}} }
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
export interface StoreMapPoint {id:string;latitude:number;longitude:number}
export function StoreMap({apiKey,center,points,onPick,onSelect}:{apiKey:string;center:[number,number];points:StoreMapPoint[];onPick?:(lat:number,lng:number)=>void;onSelect?:(id:string)=>void}){
  const node=useRef<HTMLDivElement>(null);const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const callbacks=useRef({onPick,onSelect});useEffect(()=>{callbacks.current={onPick,onSelect};},[onPick,onSelect]);
  const serialized=JSON.stringify({center,points});
  useEffect(()=>{
    if(!apiKey)return;
    let cancelled=false,map:MapObject|undefined;
    const data=JSON.parse(serialized) as {center:[number,number];points:StoreMapPoint[]};
    loadMaps(apiKey).then(api=>{
      if(cancelled||!node.current)return;
      map=new api.Map(node.current,{center:data.points.length===1?[data.points[0]!.latitude,data.points[0]!.longitude]:data.center,zoom:data.points.length===1?16:11,controls:['zoomControl','fullscreenControl']});
      data.points.forEach((point,index)=>{
        const mark=new api.Placemark([point.latitude,point.longitude],{iconContent:String(index+1)},{preset:'islands#blueCircleIcon'});
        mark.events.add('click',()=>callbacks.current.onSelect?.(point.id));map!.geoObjects.add(mark);
      });
      if(data.points.length>1){const lat=data.points.map(p=>p.latitude),lng=data.points.map(p=>p.longitude);map.setBounds([[Math.min(...lat),Math.min(...lng)],[Math.max(...lat),Math.max(...lng)]],{checkZoomRange:true,zoomMargin:40});}
      map.events.add('click',event=>{const coords=event.get('coords');if(coords.length===2)callbacks.current.onPick?.(coords[0]!,coords[1]!);});setStatus('ready');
    }).catch(()=>{if(!cancelled)setStatus('error');});
    return()=>{cancelled=true;map?.destroy();};
  },[apiKey,serialized]);
  if(!apiKey)return <div className="store-map-message">Карта пока недоступна. Адреса магазинов доступны в списке и по кнопке «Открыть в Яндекс Картах».</div>;
  return <div className="store-map-shell"><div ref={node} className="store-map" aria-label="Карта магазинов"/>{status!=='ready'&&<p className="store-map-message" role="status">{status==='error'?'Не удалось загрузить карту. Воспользуйтесь списком магазинов.':'Загружаем карту…'}</p>}</div>;
}
