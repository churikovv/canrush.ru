import sharp from 'sharp';
import type { PreparedReviewPhoto } from './review-photos';
import { getPool } from '@/db/pool';
import { MAX_PENDING_STORES, StoreError, type StoreInput } from './store-fields';
export interface Store extends StoreInput { id: string; photos: string[]; ownerId: string; status: 'pending'|'published'|'rejected'; moderationNote: string; updatedAt: Date; reviewedAt: Date | null }
/** `metro`: the stations of one name (one per line) — a store matches by its chosen station or by being within walking distance of one. */
export interface StoreFilters { brand?: string; metro?: { ids: string[]; lat: number[]; lng: number[]; km: number } }
export async function listStores(city: string, query: string, page: number, ownerId?: string, pending=false, filters: StoreFilters = {}) {
  const result = await getPool().query<Store>(`select s.*, array(select p.id::text from "storePhoto" p where p."storeId"=s.id order by p.position) as photos from "marketStore" s where
    ($1::text='' or s.city=$1) and ($2::text='' or concat_ws(' ',s.name,s.address,s.description,s.catalog::text) ilike '%' || $2 || '%')
    and ($3::text is null or s."ownerId"=$3) and (case when $4::boolean then s.status='pending' when $3::text is not null then true else s.status='published' and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId") end)
    and ($6::text='' or exists(select 1 from jsonb_array_elements(s.catalog) item where item->>'brand'=$6))
    and ($7::text[] is null or s.metro=any($7) or (s.latitude is not null and exists(select 1 from unnest($8::float8[],$9::float8[]) st(lat,lng)
      where 12742*asin(least(1,sqrt(sin(radians(st.lat-s.latitude)/2)^2+cos(radians(s.latitude))*cos(radians(st.lat))*sin(radians(st.lng-s.longitude)/2)^2)))<=$10)))
    order by s."updatedAt" desc,s.id limit 25 offset $5`,[city,query,ownerId??null,pending,(page-1)*24,filters.brand??'',filters.metro?.ids??null,filters.metro?.lat??[],filters.metro?.lng??[],filters.metro?.km??0]);
  return {items:result.rows.slice(0,24),hasMore:result.rows.length>24};
}
export interface StorePoint { id: string; name: string; city: string; address: string; metro: string | null; latitude: number; longitude: number; drinks: number }
/** Published stores of a city that have a point, for the home page map. */
export async function listStorePoints(city: string, limit = 300): Promise<StorePoint[]> {
  const { rows } = await getPool().query<StorePoint>(`select s.id, s.name, s.city, s.address, s.metro, s.latitude, s.longitude, jsonb_array_length(s.catalog)::int as drinks
    from "marketStore" s where s.city=$1 and s.status='published' and s.latitude is not null and s.longitude is not null
      and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId")
    order by s."updatedAt" desc, s.id limit $2`, [city, limit]);
  return rows.map(row => ({ ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) }));
}
/** Filter choices for a city's published stores: brands from linked drinks and the stations stores are assigned to. */
export async function getStoreFilterOptions(city: string): Promise<{ brands: string[]; metro: string[]; points: { lat: number; lng: number }[] }> {
  const { rows } = await getPool().query<{ brands: string[] | null; metro: string[] | null; points: { lat: number; lng: number }[] | null }>(`select
      array(select distinct item->>'brand' from "marketStore" s, jsonb_array_elements(s.catalog) item where s.city=$1 and s.status='published' and item->>'brand' is not null order by 1) as brands,
      array(select distinct s.metro from "marketStore" s where s.city=$1 and s.status='published' and s.metro is not null) as metro,
      array(select jsonb_build_object('lat',s.latitude,'lng',s.longitude) from "marketStore" s where s.city=$1 and s.status='published' and s.latitude is not null) as points`, [city]);
  return { brands: rows[0]?.brands ?? [], metro: rows[0]?.metro ?? [], points: (rows[0]?.points ?? []).map(point => ({ lat: Number(point.lat), lng: Number(point.lng) })) };
}
export async function getStore(id: string) {
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))return null;
  return (await getPool().query<Store>('select s.*, array(select p.id::text from "storePhoto" p where p."storeId"=s.id order by p.position) as photos from "marketStore" s where s.id=$1',[id])).rows[0]??null;
}
/** Public page of a store: published (author not blocked), or the author's own, or for site admins. */
export async function getVisibleStore(id: string, userId: string | null) {
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))return null;
  return (await getPool().query<Store>(`select s.*, array(select p.id::text from "storePhoto" p where p."storeId"=s.id order by p.position) as photos from "marketStore" s where s.id=$1 and (
   (s.status='published' and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId")) or s."ownerId"=$2
   or exists(select 1 from "user" u join "siteAdmin" a on lower(u.email)=a.email where u.id=$2))`,[id,userId])).rows[0]??null;
}
export async function saveStore(userId: string, input: StoreInput, id?: string, photoChanges?: {retained: string[]; photos: PreparedReviewPhoto[]}) {
  const db=await getPool().connect();
  try {
    await db.query('begin');
    await db.query('select id from "user" where id=$1 for update',[userId]);
    if((await db.query('select 1 from "userBlock" where "userId"=$1',[userId])).rowCount)throw new StoreError('Добавление магазинов для аккаунта ограничено.');
    if(!id){
      const counts=await db.query<{count:number;recent:boolean}>(`select count(*) filter(where status='pending')::int as count,coalesce(bool_or("createdAt">now()-interval '60 seconds'),false) as recent from "marketStore" where "ownerId"=$1`,[userId]);
      if(counts.rows[0]!.count>=MAX_PENDING_STORES || counts.rows[0]!.recent)throw new StoreError(`Подождите минуту между заявками. Одновременно можно отправить до ${MAX_PENDING_STORES} магазинов на проверку.`);
    }
    const values=[userId,input.name,input.city,input.address,input.latitude,input.longitude,input.metro,input.description,JSON.stringify(input.catalog),input.locationSource];
    const result = id ? await db.query(`update "marketStore" set name=$2,city=$3,address=$4,latitude=$5,longitude=$6,metro=$7,description=$8,catalog=$9,"locationSource"=$10,status='pending',"moderationNote"='',"reviewedAt"=null,"reviewedBy"=null,"updatedAt"=clock_timestamp() where "ownerId"=$1 and id=$11 returning id`,[...values,id]) : await db.query(`insert into "marketStore"("ownerId",name,city,address,latitude,longitude,metro,description,catalog,"locationSource") values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,values);
    if(!result.rowCount)throw new StoreError('Магазин недоступен для редактирования.');
    const storeId=result.rows[0].id as string;
    if(photoChanges){
      const {retained,photos}=photoChanges;
      if(retained.length+photos.length>5 || new Set(retained).size!==retained.length)throw new StoreError('Можно добавить не более 5 фотографий.');
      const existing=await db.query<{id:string}>('select id from "storePhoto" where "storeId"=$1',[storeId]);
      if(retained.some(photo=>!existing.rows.some(row=>row.id===photo)))throw new StoreError('Фотография не принадлежит магазину.');
      await db.query('delete from "storePhoto" where "storeId"=$1 and not(id=any($2::uuid[]))',[storeId,retained]);
      for(const [position,photoId] of retained.entries())await db.query('update "storePhoto" set position=$2 where id=$1',[photoId,position]);
      for(const [index,photo] of photos.entries())await db.query('insert into "storePhoto"("storeId",position,data,thumbnail) values($1,$2,$3,$4)',[storeId,retained.length+index,photo.data,photo.thumbnail]);
    }
    await db.query('commit');return storeId;
  }catch(error){await db.query('rollback');if((error as {code?:string}).code==='23505')throw new StoreError('Магазин с этим названием и адресом уже добавлен.');throw error;}finally{db.release();}
}
export async function moderateStore(adminId: string,id: string,status:'published'|'rejected',note: string,version: string) {
  if(!['published','rejected'].includes(status)||note.length>500 || (status==='rejected'&&!note.trim()))throw new StoreError('Для отклонения укажите причину (до 500 символов).');
  const result=await getPool().query(`update "marketStore" set status=$3,"moderationNote"=$4,"reviewedBy"=$1,"reviewedAt"=now() where id=$2 and status='pending' and date_trunc('milliseconds',"updatedAt")=$5::timestamptz
    and exists(select 1 from "user" u join "siteAdmin" a on lower(u.email)=a.email where u.id=$1)
    and not exists(select 1 from "userBlock" b where b."userId"="marketStore"."ownerId") returning id`,[adminId,id,status,note.trim(),version]);
  if(!result.rowCount)throw new StoreError('Заявка изменилась, уже проверена или автор заблокирован. Обновите страницу.');
}

export type StorePhotoSize = 'full' | 'card' | 'thumbnail';
/** Visible store photo bytes. The `card` size (up to 960 px) is made from the original on first request and kept. */
export async function getStorePhoto(id:string,userId:string|null,size:StorePhotoSize='full'){
 const column=size==='thumbnail'?'p.thumbnail':size==='card'?'coalesce(p.preview,p.data)':'p.data';
 const result=await getPool().query<{data:Buffer;ready:boolean}>(`select ${column} as data, p.preview is not null as ready from "storePhoto" p join "marketStore" s on s.id=p."storeId" where p.id=$1 and (
  (s.status='published' and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId")) or s."ownerId"=$2
  or exists(select 1 from "user" u join "siteAdmin" a on lower(u.email)=a.email where u.id=$2))`,[id,userId]);
 const row=result.rows[0];if(!row)return null;
 if(size!=='card'||row.ready)return row.data;
 try{
  const preview=await sharp(row.data).resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  await getPool().query('update "storePhoto" set preview=$2 where id=$1 and preview is null',[id,preview]);
  return preview;
 }catch{return row.data;}
}
