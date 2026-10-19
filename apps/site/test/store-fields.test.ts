import { expect,it } from 'vitest';
import { parseStore,METRO,nearestStations,formatDistance,storeMapUrl,stationDistanceKm,parseStoreReference,parseStoreTransferTarget } from '../src/lib/store-fields';
function form(){const f=new FormData();for(const [key,value] of Object.entries({name:'Энергомаркет',city:'moscow',address:'Тверская, 1',latitude:'55.75',longitude:'37.61',catalog:'[]'}))f.set(key,value);return f;}
it('accepts a store without catalog or metro and checks coordinates',()=>{
 expect(parseStore(form()).catalog).toEqual([]);
 const f=form();f.set('latitude','');expect(()=>parseStore(f)).toThrow();f.set('longitude','');
 expect(parseStore(f)).toMatchObject({latitude:null,longitude:null,locationSource:null,metro:null});
 f.set('longitude','37.61');f.set('latitude','Infinity');expect(()=>parseStore(f)).toThrow();f.set('latitude','10');expect(()=>parseStore(f)).toThrow();
});
it('accepts only stations belonging to the selected city',()=>{
 const f=form();f.set('metro',METRO.moscow![0]!.id);f.set('latitude','55.6');f.set('longitude','37.3');expect(parseStore(f).metro).toBe(METRO.moscow![0]!.id);f.set('latitude','55.75');f.set('longitude','37.61');
 f.set('metro',METRO.moscow![0]!.id);expect(parseStore(f).metro).toBe(METRO.moscow![0]!.id);
 f.set('metro',METRO.kazan![0]!.id);expect(()=>parseStore(f)).toThrow('станцию');
 f.set('city','omsk');f.set('latitude','54.989347');f.set('longitude','73.368221');expect(()=>parseStore(f)).toThrow();f.set('metro','');expect(parseStore(f).city).toBe('omsk');
});
it('validates optional stock and price without trusting browser input',()=>{
 const f=form();f.set('catalog',JSON.stringify([{name:'Monster',price:null,availability:'unknown'}]));expect(parseStore(f).catalog[0]?.price).toBeNull();
 f.set('catalog',JSON.stringify([{name:'Monster',price:-1,availability:'available'}]));expect(()=>parseStore(f)).toThrow();
 f.set('catalog',JSON.stringify(Array.from({length:51},(_,i)=>({name:String(i),price:100,availability:'available'}))));expect(()=>parseStore(f)).toThrow();
 f.set('catalog',JSON.stringify([{name:'Monster',price:100,availability:'available'},{name:'monster',price:null,availability:'unknown'}]));expect(()=>parseStore(f)).toThrow('повторяющиеся');
});
it('station IDs are unique within every city',()=>{
 for(const stations of Object.values(METRO))expect(new Set(stations.map(s=>s.id)).size).toBe(stations.length);
});
it('marks the point source and lets manual coordinates win',()=>{
 const f=form();expect(parseStore(f).locationSource).toBe('manual');
 f.set('locationSource','geocoded');expect(parseStore(f).locationSource).toBe('geocoded');
 f.set('locationSource','anything');expect(parseStore(f).locationSource).toBe('manual');
});
it('fills the nearest metro, МЦК or МЦД station from the point when none was chosen',()=>{
 const mcd=METRO.moscow!.find(s=>s.line==='МЦД-2'&&!METRO.moscow!.some(o=>o.name===s.name&&o.id!==s.id))!;
 const f=form();f.set('latitude',String(mcd.lat+0.001));f.set('longitude',String(mcd.lng));
 expect(parseStore(f).metro).toBe(mcd.id);
 f.set('latitude','55.6');f.set('longitude','37.25');expect(parseStore(f).metro).toBeNull();
 const lines=new Set(METRO.moscow!.map(s=>s.line));
 for(const line of ['МЦК','МЦД-1','МЦД-2','МЦД-3','МЦД-4'])expect(lines).toContain(line);
 for(const stations of Object.values(METRO))for(const s of stations)expect(Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&/^#[0-9A-F]{6}$/.test(s.color)).toBe(true);
});
it('orders nearby stations by distance and formats it',()=>{
 const near=nearestStations('moscow',55.7558,37.6173,5);
 expect(near.length).toBeGreaterThan(1);
 expect(near.map(n=>n.km)).toEqual([...near.map(n=>n.km)].sort((a,b)=>a-b));
 expect(near.every(n=>n.km<=2)).toBe(true);
 expect(stationDistanceKm(55.75,37.61,{lat:55.75,lng:37.61})).toBe(0);
 expect(formatDistance(0.347)).toBe('350 м');expect(formatDistance(0.001)).toBe('10 м');expect(formatDistance(1.26)).toBe('1,3 км');
});
it('keeps catalog links and custom drinks, rejecting duplicates of either',()=>{
 const f=form();
 f.set('catalog',JSON.stringify([{name:'Monster · Ultra White',price:15900,availability:'available',brand:'Monster',flavor:'monster_ultra_white'},{name:'Свой',price:null,availability:'unknown',brand:'',flavor:'x'}]));
 expect(parseStore(f).catalog).toEqual([{name:'Monster · Ultra White',price:15900,availability:'available',brand:'Monster',flavor:'monster_ultra_white'},{name:'Свой',price:null,availability:'unknown'}]);
 f.set('catalog',JSON.stringify([{name:'A',price:null,availability:'unknown',brand:'Monster',flavor:'monster_ultra_white'},{name:'B',price:null,availability:'unknown',brand:'Monster',flavor:'monster_ultra_white'}]));
 expect(()=>parseStore(f)).toThrow('повторяющиеся');
});
it('links to the address search when the store has no point',()=>{
 expect(storeMapUrl({city:'moscow',address:'Тверская, 1',latitude:null,longitude:null})).toBe('https://yandex.ru/maps/?text='+encodeURIComponent('Москва, Тверская, 1'));
 expect(storeMapUrl({city:'moscow',address:'x',latitude:55.75,longitude:37.61})).toContain('pt=37.61,55.75');
});
it('reads a store id from a link or the bare id',()=>{
 const id='954afd9c-1451-4aa8-9b67-75b5b60d55a3';
 expect(parseStoreReference(`https://canrush.ru/market/stores/${id.toUpperCase()}/edit`)).toBe(id);
 expect(parseStoreReference(` ${id} `)).toBe(id);
 expect(parseStoreReference('https://canrush.ru/market/stores')).toBeNull();
});
it('reads the new store owner from an email, @username or profile link',()=>{
 expect(parseStoreTransferTarget(' Owner@Example.com ')).toEqual({kind:'email',value:'owner@example.com'});
 expect(parseStoreTransferTarget('@Raze')).toEqual({kind:'username',value:'raze'});
 expect(parseStoreTransferTarget('https://canrush.ru/profile/raze/collection')).toEqual({kind:'username',value:'raze'});
 expect(parseStoreTransferTarget('no spaces allowed')).toBeNull();
 expect(parseStoreTransferTarget('ab')).toBeNull();
});
