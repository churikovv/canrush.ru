import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { CITIES } from '@canrush/shared';
import type { CatalogFile } from '../src/lib/catalog-files';
const url=process.env.TEST_DATABASE_URL??'postgresql://localhost:5432/canrush_site_test';
if(new URL(url).pathname!=='/canrush_site_test')throw Error('Test DB only');
const pool=new Pool({connectionString:url,max:4});
vi.mock('../src/db/pool',()=>({getPool:()=>pool}));
const api=await import('../src/lib/notifications');
const ids=[randomUUID(),randomUUID()];const [owner,actor]=ids as [string,string];let review:string;
beforeAll(async()=>{
 for(const id of ids)await pool.query(`insert into "user"(id,name,email,username,"emailVerified","createdAt","updatedAt")values($1,'Notify test',$2,$3,true,now(),now())`,[id,id+'@example.com','notify_'+id.slice(0,8)]);
 review=(await pool.query(`insert into review("userId",brand,flavor,design,taste,text)values($1,'Burn','original',8,9,'Review')returning id`,[owner])).rows[0].id;
});
afterAll(async()=>{await pool.query('delete from "user" where id=any($1::text[])',[ids]);await pool.end();});
it('notifies followers once despite refollowing and rolls back together with the event',async()=>{
 await pool.query('insert into "userFollow"("userId","targetId")values($1,$2)',[actor,owner]);
 await pool.query('delete from "userFollow" where "userId"=$1',[actor]);
 await pool.query('insert into "userFollow"("userId","targetId")values($1,$2)',[actor,owner]);
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='follow')).toHaveLength(1);
 expect((await api.getNotifications(actor)).unread).toBe(0);
 const client=await pool.connect();try{await client.query('begin');await client.query('insert into "profileComment"("profileId","userId",text)values($1,$2,\'Rollback\')',[owner,actor]);await client.query('rollback');}finally{client.release();}
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='wall-comment')).toHaveLength(0);
});
it('notifies likes and comments, ignores dislikes/self comments, and isolates read state',async()=>{
 await pool.query('insert into "reviewReaction"("reviewId","userId",value)values($1,$2,-1)',[review,actor]);
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='like')).toHaveLength(0);
 await pool.query('update "reviewReaction" set value=1 where "reviewId"=$1',[review]);
 await pool.query('update "reviewReaction" set value=-1 where "reviewId"=$1',[review]);
 await pool.query('update "reviewReaction" set value=1 where "reviewId"=$1',[review]);
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='like')).toHaveLength(1);
 await pool.query('insert into "reviewComment"("reviewId","userId",text)values($1,$2,\'Own\')',[review,owner]);
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='review-comment')).toHaveLength(0);
 const comment=(await pool.query('insert into "reviewComment"("reviewId","userId",text)values($1,$2,\'Hello\')returning id',[review,actor])).rows[0].id;
 const inbox=await api.getNotifications(owner);const notice=inbox.items.find(x=>x.kind==='review-comment')!;
 expect(notice.detail).toContain('Hello');expect(notice.href).toContain(review);
 await api.readNotifications(actor,notice.id);expect((await api.getNotifications(owner)).unread).toBe(inbox.unread);
 await api.readNotifications(owner,notice.id);expect((await api.getNotifications(owner)).unread).toBe(inbox.unread-1);
 await pool.query('delete from "reviewComment" where id=$1',[comment]);expect((await api.getNotifications(owner)).items.some(x=>x.id===notice.id)).toBe(false);
 await api.readNotifications(owner);expect((await api.getNotifications(owner)).unread).toBe(0);
});
it('compares prices per city and volume with deduplication, stale protection and favorite reset',async()=>{
 await pool.query('insert into favorite("userId",brand,flavor)values($1,\'Burn\',\'original\')',[owner]);
 const city=CITIES[0]!;const other=CITIES[1]!;const base=Date.now()-60000;
 const snapshot=(price:number,tick:number,volume=250):CatalogFile=>({generatedAt:new Date(base+tick*1000).toISOString(),status:'ok',groups:[{brand:'Burn',flavor:'original',minPrice:price,variants:[{source:'edadeal',volumeMl:volume,price,url:'https://example.com',fetchedAt:new Date().toISOString()}]}]});
 await api.syncFavoritePrices(owner,city,snapshot(100,0));expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='price')).toHaveLength(0);
 await Promise.all([api.syncFavoritePrices(owner,city,snapshot(90,1)),api.syncFavoritePrices(owner,city,snapshot(90,1))]);
 let notices=(await api.getNotifications(owner)).items.filter(x=>x.kind==='price');expect(notices).toHaveLength(1);expect(notices[0]?.detail).toContain('100 ₽ → 90 ₽');
 await api.syncFavoritePrices(owner,other,snapshot(50,2));await api.syncFavoritePrices(owner,city,snapshot(60,3,500));
 await api.syncFavoritePrices(owner,city,{...snapshot(1,4),status:'stale'});await api.syncFavoritePrices(owner,city,snapshot(100,0));
 expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='price')).toHaveLength(1);
 await api.syncFavoritePrices(owner,city,snapshot(110,5));notices=(await api.getNotifications(owner)).items.filter(x=>x.kind==='price');expect(notices).toHaveLength(2);expect(notices[0]?.title).toContain('выросла');
 await pool.query('delete from favorite where "userId"=$1',[owner]);expect((await pool.query('select 1 from "favoritePriceWatch" where "userId"=$1',[owner])).rowCount).toBe(0);
 await pool.query('insert into favorite("userId",brand,flavor)values($1,\'Burn\',\'original\')',[owner]);await api.syncFavoritePrices(owner,city,snapshot(20,6));expect((await api.getNotifications(owner)).items.filter(x=>x.kind==='price')).toHaveLength(2);
});
it('paginates by cursor without duplicates and does not expose another recipient’s cursor',async()=>{
 for(let i=0;i<23;i++)await pool.query('insert into "profileComment"("profileId","userId",text)values($1,$2,$3)',[owner,actor,'Wall '+i]);
 const first=await api.getNotifications(owner);const second=await api.getNotifications(owner,first.items.at(-1)!.id);
 expect(first.hasMore).toBe(true);expect(first.items).toHaveLength(20);expect(new Set([...first.items,...second.items].map(x=>x.id)).size).toBe(first.items.length+second.items.length);
 expect((await api.getNotifications(actor,first.items.at(-1)!.id)).items).toHaveLength(0);
});
