import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it,vi } from 'vitest';
import { Pool } from 'pg';
const url=process.env.TEST_DATABASE_URL??'postgresql://localhost:5432/canrush_site_test';
if(new URL(url).pathname!=='/canrush_site_test')throw new Error('Test DB only');
const pool=new Pool({connectionString:url,max:3});vi.mock('../src/db/pool',()=>({getPool:()=>pool}));
const api=await import('../src/lib/stores');
import type { StoreInput } from '../src/lib/store-fields';
const [owner,admin,stranger]=[randomUUID(),randomUUID(),randomUUID()] as [string,string,string];
let id:string;
const adminEmail=admin+'@example.com';
const placed=async(name:string,status:string)=>(await pool.query<{id:string}>(`insert into "marketStore"("ownerId",name,city,address,status) values($1,$2,'moscow',$2,$3) returning id`,[owner,name,status])).rows[0]!.id;
const input:StoreInput={name:'Test '+randomUUID(),city:'moscow',address:'Test 1',latitude:55.75,longitude:37.61,locationSource:'manual',metro:null,description:'',catalog:[]};
beforeAll(async()=>{for(const uid of [owner,admin,stranger])await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Store test',$2,true,now(),now())`,[uid,uid+'@example.com']);await pool.query('insert into "siteAdmin"(email) values($1)',[admin+'@example.com']);});
afterAll(async()=>{await pool.query('delete from "siteAdmin" where email=$1',[admin+'@example.com']);await pool.query('delete from "user" where id=any($1::text[])',[[owner,admin,stranger]]);await pool.end();});
it('keeps pending stores private and enforces ownership, duplicates and cooldown',async()=>{
 id=await api.saveStore(owner,input);
 expect((await api.listStores('moscow',input.name,1)).items).toHaveLength(0);
 expect((await api.listStores('moscow',input.name,1,owner)).items).toHaveLength(1);
 await expect(api.saveStore(stranger,input,id)).rejects.toThrow('редактирования');
 await expect(api.saveStore(owner,{...input,name:'Another'})).rejects.toThrow('минуту');
 await expect(api.saveStore(stranger,input)).rejects.toThrow('уже добавлен');
});
it('only administrators can publish the exact reviewed version',async()=>{
 const row=(await api.getStore(id))!;
 await expect(api.moderateStore(stranger,id,'published','',row.updatedAt.toISOString())).rejects.toThrow();
 await expect(api.moderateStore(admin,id,'published','',new Date(0).toISOString())).rejects.toThrow();
 await api.moderateStore(admin,id,'published','',row.updatedAt.toISOString());
 expect((await api.listStores('moscow',input.name,1)).items).toHaveLength(1);
 await api.saveStore(owner,{...input,description:'Changed'},id);
 expect((await api.listStores('moscow',input.name,1)).items).toHaveLength(0);
});
it('requires a rejection reason and lets the owner correct their submission',async()=>{
 const row=(await api.getStore(id))!;
 await expect(api.moderateStore(admin,id,'rejected','',row.updatedAt.toISOString())).rejects.toThrow('причину');
 await api.moderateStore(admin,id,'rejected','Уточните адрес',row.updatedAt.toISOString());
 expect((await api.getStore(id))?.moderationNote).toBe('Уточните адрес');
 await api.saveStore(owner,input,id);
 expect((await api.getStore(id))?.moderationNote).toBe('');
});
it('keeps photos private until moderation and validates retained ownership atomically',async()=>{
 const photo={data:await sharp({create:{width:1600,height:1000,channels:3,background:'#006eff'}}).webp().toBuffer(),thumbnail:Buffer.from('thumbnail fixture')};
 await api.saveStore(owner,input,id,{retained:[],photos:[photo]});
 const row=(await api.getStore(id))!;
 const photoId=row.photos[0]!;
 expect(row.photos).toHaveLength(1);
 expect(await api.getStorePhoto(photoId,null)).toBeNull();
 expect(await api.getStorePhoto(photoId,stranger)).toBeNull();
 // A request's photos are not published yet, so the route never lets a device keep them.
 expect(await api.getStorePhoto(photoId,owner)).toEqual({data:photo.data,published:false});
 expect(await api.getStorePhoto(photoId,admin,'thumbnail')).toEqual({data:photo.thumbnail,published:false});
 const card=(await api.getStorePhoto(photoId,owner,'card'))?.data;expect(card?.length).toBeGreaterThan(0);
 expect((await pool.query('select preview from "storePhoto" where id=$1',[photoId])).rows[0].preview).toEqual(card);
 expect((await api.getStorePhoto(photoId,owner,'card'))?.data).toEqual(card);
 await api.moderateStore(admin,id,'published','',row.updatedAt.toISOString());
 expect(await api.getStorePhoto(photoId,null)).toEqual({data:photo.data,published:true});
 await expect(api.saveStore(owner,input,id,{retained:[randomUUID()],photos:[]})).rejects.toThrow('не принадлежит');
 expect((await api.getStore(id))?.status).toBe('published');
 await api.saveStore(owner,input,id,{retained:[photoId],photos:[]});
 expect(await api.getStorePhoto(photoId,null)).toBeNull();
 expect((await api.getStore(id))?.photos).toEqual([photoId]);
 await api.saveStore(owner,input,id,{retained:[],photos:[]});
 expect(await api.getStorePhoto(photoId,owner)).toBeNull();
});
it('stores an address-only point, its source and catalog links; the page follows moderation visibility',async()=>{
 const catalog=[{name:'Monster · Ultra White',price:15900,availability:'available' as const,brand:'Monster',flavor:'monster_ultra_white'},{name:'Местный энергетик',price:null,availability:'unknown' as const}];
 await api.saveStore(owner,{...input,latitude:null,longitude:null,locationSource:null,catalog},id);
 let row=(await api.getStore(id))!;
 expect([row.latitude,row.longitude,row.locationSource]).toEqual([null,null,null]);
 expect(row.catalog).toEqual(catalog);
 expect(await api.getVisibleStore(id,null)).toBeNull();
 expect(await api.getVisibleStore(id,stranger)).toBeNull();
 expect((await api.getVisibleStore(id,owner))?.id).toBe(id);
 expect((await api.getVisibleStore(id,admin))?.id).toBe(id);
 await api.moderateStore(admin,id,'published','',row.updatedAt.toISOString());
 expect((await api.getVisibleStore(id,null))?.id).toBe(id);
 await api.saveStore(owner,{...input,locationSource:'geocoded'},id);
 row=(await api.getStore(id))!;
 expect([row.latitude,row.longitude,row.locationSource]).toEqual([55.75,37.61,'geocoded']);
 await expect(pool.query('update "marketStore" set "locationSource"=null where id=$1',[id])).rejects.toThrow();
 expect(await api.getVisibleStore('not-a-uuid',owner)).toBeNull();
});
it('lets the team edit someone else’s store in place, keeping its status, and lists it for the admin with its author',async()=>{
 const row=(await api.getStore(id))!;
 if(row.status!=='published')await api.moderateStore(admin,id,'published','',row.updatedAt.toISOString());
 // Not the team: refused even with the staff flag.
 await expect(api.saveStore(stranger,{...input,description:'Чужая правка'},id,undefined,true)).rejects.toThrow('редактирования');
 await api.saveStore(admin,{...input,description:'Правка модератора'},id,undefined,true);
 expect(await api.getStore(id)).toMatchObject({status:'published',description:'Правка модератора',ownerId:owner});
 const {items}=await api.listStoresForAdmin('published',1,input.name.slice(0,20));
 expect(items.find(store=>store.id===id)?.author).toMatchObject({name:'Store test'});
});

it('takes a published store back to its owner as a draft, for the team only and with a reason',async()=>{
 const name='Draft '+randomUUID();
 const draft=await placed(name,'published');
 const version=(await api.getStore(draft))!.updatedAt.toISOString();
 await expect(api.returnStoreToDraft(stranger,'stranger@example.com',draft,'Нет фото',version)).rejects.toThrow('изменился');
 await expect(api.returnStoreToDraft(admin,adminEmail,draft,'  ',version)).rejects.toThrow('причину');
 await expect(api.returnStoreToDraft(admin,adminEmail,draft,'Нет фото',new Date(0).toISOString())).rejects.toThrow('изменился');
 await api.returnStoreToDraft(admin,adminEmail,draft,'Нет фото',version);
 const row=(await api.getStore(draft))!;
 expect(row).toMatchObject({status:'draft',moderationNote:'Нет фото'});
 expect((await api.listStores('moscow',name,1)).items).toHaveLength(0);
 expect((await api.listStores('moscow',name,1,owner)).items).toHaveLength(1);
 expect((await api.listStoresForAdmin('draft',1,name)).items.map(item=>item.id)).toEqual([draft]);
 expect((await pool.query(`select payload from notification where "userId"=$1 and kind='store-moderation' and payload->>'id'=$2`,[owner,draft])).rows).toEqual([{payload:{action:'returned',id:draft,name,note:'Нет фото'}}]);
 expect((await pool.query(`select action from "adminAuditLog" where "targetType"='store' and "targetId"=$1`,[draft])).rows).toEqual([{action:'return-to-draft'}]);
 await expect(api.returnStoreToDraft(admin,adminEmail,draft,'Ещё раз',row.updatedAt.toISOString())).rejects.toThrow('изменился');
 await api.saveStore(owner,{...input,name,address:'Draft 2'},draft);
 expect(await api.getStore(draft)).toMatchObject({status:'pending',moderationNote:''});
});
it('deletes any store for the team only, with a reason, and tells the owner',async()=>{
 const name='Delete '+randomUUID();
 const doomed=await placed(name,'pending');
 const version=(await api.getStore(doomed))!.updatedAt.toISOString();
 await expect(api.deleteStoreAsTeam(stranger,'stranger@example.com',doomed,'Выдуман',version)).rejects.toThrow('изменился');
 await expect(api.deleteStoreAsTeam(admin,adminEmail,doomed,'',version)).rejects.toThrow('причину');
 await api.deleteStoreAsTeam(admin,adminEmail,doomed,'Выдуман',version);
 expect(await api.getStore(doomed)).toBeFalsy();
 expect((await pool.query(`select payload from notification where "userId"=$1 and kind='store-moderation' and payload->>'id'=$2`,[owner,doomed])).rows).toEqual([{payload:{action:'deleted',id:doomed,name,note:'Выдуман'}}]);
 expect((await pool.query(`select action from "adminAuditLog" where "targetType"='store' and "targetId"=$1`,[doomed])).rows).toEqual([{action:'delete'}]);
});
it('shows a drink only in published stores that have it, after the catalog aliases, cheapest first',async()=>{
  const seller=randomUUID(),banned=randomUUID(),brand='Unknown',flavor='unresolved:223f2588885d0ae5b061e544';
  for(const uid of [seller,banned])await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'Store',$2,true,now(),now())`,[uid,`${uid}@example.com`]);
  await pool.query('insert into "userBlock"("userId") values($1)',[banned]);
  const store=async(ownerId:string,status:string,name:string,catalog:object[])=>pool.query(`insert into "marketStore"("ownerId",name,city,address,catalog,status) values($1,$2,'moscow','Test',$3::jsonb,$4)`,[ownerId,`${name} ${seller}`,JSON.stringify(catalog),status]);
  const item=(price:number|null,availability='available',b='Adrenaline Rush',f='game_fuel_citrus_buff')=>({name:'Citrus Buff',price,availability,brand:b,flavor:f});
  await store(seller,'published','Дорогой',[item(30000)]);
  await store(seller,'published','Дешёвый старым именем',[item(15000,'available',brand,flavor)]);
  await store(seller,'published','Без цены',[item(null,'unknown')]);
  await store(seller,'published','Закончился',[item(100,'unavailable')]);
  await store(seller,'pending','На проверке',[item(100)]);
  await store(banned,'published','Заблокирован',[item(100)]);
  try{
    const offers=(await api.getDrinkStoreOffers('Adrenaline Rush','game_fuel_citrus_buff')).filter(offer=>offer.name.endsWith(seller));
    expect(offers.map(offer=>[offer.name.replace(` ${seller}`,''),offer.price])).toEqual([['Дешёвый старым именем',15000],['Дорогой',30000],['Без цены',null]]);
  }finally{await pool.query('delete from "user" where id=any($1::text[])',[[seller,banned]])}
});

