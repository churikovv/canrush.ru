import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it,vi } from 'vitest';
import { Pool } from 'pg';
import { profileCompatibility } from '../src/lib/profile-compatibility';
const url=process.env.TEST_DATABASE_URL??'postgresql://localhost:5432/canrush_site_test';
if(new URL(url).pathname!=='/canrush_site_test')throw new Error('Test DB only');
const pool=new Pool({connectionString:url});vi.mock('../src/db/pool',()=>({getPool:()=>pool}));
const {recordCompatibility}=await import('../src/lib/profile-compatibility-history');
// Mixed-case auth IDs can sort differently in JS and the database locale.
const rawIds=['Z'+randomUUID(),'a'+randomUUID()];
const ordered=await pool.query<{low:string;high:string}>('select least($1::text,$2::text) as low,greatest($1::text,$2::text) as high',rawIds);
const ids=[ordered.rows[0]!.low,ordered.rows[0]!.high] as [string,string];
const favorites=['mango','peach','apple'].map(flavor=>({brand:'Monster',flavor}));
const value=profileCompatibility({favorites,reviews:[]},{favorites,reviews:[]});
beforeAll(async()=>{for(const id of ids)await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt") values($1,'History test',$2,true,now(),now())`,[id,id+'@example.com']);});
afterAll(async()=>{await pool.query('delete from "user" where id=any($1::text[])',[ids]);await pool.end();});
it('records one daily snapshot for either viewing direction and handles a missing baseline',async()=>{
 expect(await recordCompatibility(ids[0],ids[1],value)).toEqual({delta:null,reason:'history'});
 await recordCompatibility(ids[1],ids[0],value);
 expect((await pool.query('select * from "profileCompatibilitySnapshot" where "userLow"=$1 and "userHigh"=$2',ids)).rows).toHaveLength(1);
});
it('compares month-old snapshots for increases, decreases and equality',async()=>{
 await pool.query(`insert into "profileCompatibilitySnapshot"("userLow","userHigh",day,score,criteria,parts) values($1,$2,(now() at time zone 'Europe/Moscow')::date-30,90,'11100','[]')`,ids);
 expect((await recordCompatibility(...ids,value)).delta).toBe(10);
 expect((await recordCompatibility(...ids,{...value,score:80})).delta).toBe(-10);
 expect((await recordCompatibility(...ids,{...value,score:90})).delta).toBe(0);
});
it('does not compare different criteria or insufficient data',async()=>{
 await pool.query('update "profileCompatibilitySnapshot" set criteria=$3 where "userLow"=$1 and "userHigh"=$2 and day<current_date',[...ids,'11111']);
 expect(await recordCompatibility(...ids,value)).toEqual({delta:null,reason:'criteria'});
 expect(await recordCompatibility(...ids,{...value,score:null})).toEqual({delta:null,reason:'data'});
});
