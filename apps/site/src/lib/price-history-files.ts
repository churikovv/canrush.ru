import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import { findCity, type CatalogGroup } from '@canrush/shared';
import { mergeCatalogAliases } from './catalog-files';
import { collectPriceHistory, type PriceSeries } from './price-history';
const cache=new Map<string,{expires:number;value:Promise<PriceSeries[]>}>();
export function getPriceHistory(city:string,brand:string,flavor:string):Promise<PriceSeries[]> {
 if(!findCity(city))return Promise.resolve([]);
 const key=JSON.stringify([city,brand,flavor]);const found=cache.get(key);
 if(found&&found.expires>Date.now())return found.value;
 const value=readHistory(city,brand,flavor).catch(error=>{cache.delete(key);throw error;});
 if(cache.size>=100)cache.delete(cache.keys().next().value!);
 cache.set(key,{expires:Date.now()+5*60_000,value});return value;
}
async function readHistory(city:string,brand:string,flavor:string){
 const root=process.env.PRICE_HISTORY_DIR??path.resolve(process.cwd(),'../../data/regions');
 const directory=path.join(root,city,'history');
 let files:string[];try{files=await readdir(directory);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
 const today=new Date().toISOString().slice(0,10),start=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const snapshots:{date:string;groups:CatalogGroup[]}[]=[];
 for(const file of files.filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)&&f.slice(0,10)>=start&&f.slice(0,10)<=today).sort()){
  try{
   const data=JSON.parse(await readFile(path.join(directory,file),'utf8')) as {cityId?:string;groups?:CatalogGroup[]};
   if(data.cityId===city&&Array.isArray(data.groups))snapshots.push({date:file.slice(0,10),groups:mergeCatalogAliases(data.groups.filter(g=>g.brand===brand))});
  }catch(error){if(error instanceof SyntaxError||(error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
 }
 return collectPriceHistory(snapshots,brand,flavor);
}
