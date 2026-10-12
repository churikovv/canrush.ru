import type { PreparedReviewPhoto } from './review-photos';
import { getPool } from '@/db/pool';
import { StoreError, type StoreInput } from './store-fields';
export interface Store extends StoreInput { id: string; photos: string[]; ownerId: string; status: 'pending'|'published'|'rejected'; moderationNote: string; updatedAt: Date; reviewedAt: Date | null }
export async function listStores(city: string, query: string, page: number, ownerId?: string, pending=false) {
  const result = await getPool().query<Store>(`select s.*, array(select p.id::text from "storePhoto" p where p."storeId"=s.id order by p.position) as photos from "marketStore" s where
    ($1::text='' or s.city=$1) and ($2::text='' or concat_ws(' ',s.name,s.address,s.description,s.catalog::text) ilike '%' || $2 || '%')
    and ($3::text is null or s."ownerId"=$3) and (case when $4::boolean then s.status='pending' when $3::text is not null then true else s.status='published' and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId") end)
    order by s."updatedAt" desc,s.id limit 25 offset $5`,[city,query,ownerId??null,pending,(page-1)*24]);
  return {items:result.rows.slice(0,24),hasMore:result.rows.length>24};
}
export async function getStore(id: string) {
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))return null;
  return (await getPool().query<Store>('select s.*, array(select p.id::text from "storePhoto" p where p."storeId"=s.id order by p.position) as photos from "marketStore" s where s.id=$1',[id])).rows[0]??null;
}
export async function saveStore(userId: string, input: StoreInput, id?: string, photoChanges?: {retained: string[]; photos: PreparedReviewPhoto[]}) {
  const db=await getPool().connect();
  try {
    await db.query('begin');
    await db.query('select id from "user" where id=$1 for update',[userId]);
    if((await db.query('select 1 from "userBlock" where "userId"=$1',[userId])).rowCount)throw new StoreError('Добавление магазинов для аккаунта ограничено.');
    if(!id){
      const counts=await db.query<{count:number;recent:boolean}>(`select count(*) filter(where status='pending')::int as count,coalesce(bool_or("createdAt">now()-interval '60 seconds'),false) as recent from "marketStore" where "ownerId"=$1`,[userId]);
      if(counts.rows[0]!.count>=10 || counts.rows[0]!.recent)throw new StoreError('Подождите минуту между заявками. Одновременно можно отправить до 10 магазинов на проверку.');
    }
    const values=[userId,input.name,input.city,input.address,input.latitude,input.longitude,input.metro,input.description,JSON.stringify(input.catalog)];
    const result = id ? await db.query(`update "marketStore" set name=$2,city=$3,address=$4,latitude=$5,longitude=$6,metro=$7,description=$8,catalog=$9,status='pending',"moderationNote"='',"reviewedAt"=null,"reviewedBy"=null,"updatedAt"=clock_timestamp() where "ownerId"=$1 and id=$10 returning id`,[...values,id]) : await db.query(`insert into "marketStore"("ownerId",name,city,address,latitude,longitude,metro,description,catalog) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,values);
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

export async function getStorePhoto(id:string,userId:string|null,thumbnail=false){
 const result=await getPool().query<{data:Buffer}>(`select p.${thumbnail?'thumbnail':'data'} as data from "storePhoto" p join "marketStore" s on s.id=p."storeId" where p.id=$1 and (
  (s.status='published' and not exists(select 1 from "userBlock" b where b."userId"=s."ownerId")) or s."ownerId"=$2
  or exists(select 1 from "user" u join "siteAdmin" a on lower(u.email)=a.email where u.id=$2))`,[id,userId]);
 return result.rows[0]?.data??null;
}
