import { expect,it } from 'vitest';
import { parseStore,METRO } from '../src/lib/store-fields';
function form(){const f=new FormData();for(const [key,value] of Object.entries({name:'Энергомаркет',city:'moscow',address:'Тверская, 1',latitude:'55.75',longitude:'37.61',catalog:'[]'}))f.set(key,value);return f;}
it('accepts a store without catalog or metro and checks coordinates',()=>{
 expect(parseStore(form()).catalog).toEqual([]);
 const f=form();f.set('latitude','');expect(()=>parseStore(f)).toThrow();f.set('latitude','Infinity');expect(()=>parseStore(f)).toThrow();f.set('latitude','10');expect(()=>parseStore(f)).toThrow();
});
it('accepts only stations belonging to the selected city',()=>{
 const f=form();f.set('metro',METRO.moscow![0]!.id);expect(parseStore(f).metro).toBe(METRO.moscow![0]!.id);
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
