import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { MarketError, marketId, canTransitionOrder, parseQuantity, type MarketFilters, type Delivery, type ListingInput, type OrderStatus } from './market-fields';
import type { PreparedReviewPhoto } from './review-photos';

export interface Listing extends ListingInput { id: string; sellerId: string; sellerName: string; username: string | null; closed: boolean; createdAt: string; photos: string[] }
export interface MarketOrder { id: string; listingId: string; buyerId: string; sellerId: string; status: OrderStatus; title: string; price: number; unitPrice: number; quantity: number; city: string; delivery: Delivery[]; closed: boolean; buyerName: string; sellerName: string; updatedAt: string; unread: number }
export interface MarketMessage { id: string; senderId: string; text: string; createdAt: string; photos: string[] }
async function transaction<T>(work: (db: PoolClient) => Promise<T>) {
  const db = await getPool().connect();
  try { await db.query('begin'); const result = await work(db); await db.query('commit'); return result; }
  catch (error) { await db.query('rollback'); throw error; }
  finally { db.release(); }
}
async function allowed(db: PoolClient, userId: string) {
  await db.query('select id from "user" where id=$1 for update', [userId]);
  const result = await db.query('select 1 from "userBlock" where "userId"=$1', [userId]);
  if (result.rowCount) throw new MarketError('Маркет и отправка сообщений для этого аккаунта ограничены.');
}
async function cooldown(db: PoolClient, userId: string, field: 'lastMarketListingAt' | 'lastMarketOrderAt' | 'lastMarketMessageAt', seconds: number) {
  const result = await db.query(`update "user" set "${field}"=clock_timestamp() where id=$1 and ("${field}" is null or "${field}"<clock_timestamp()-$2*interval '1 second') returning id`, [userId, seconds]);
  if (!result.rowCount) throw new MarketError(`Слишком часто. Повторите через ${seconds} сек.`);
}
async function savePhotos(db: PoolClient, kind: 'listingId' | 'messageId', id: string, photos: PreparedReviewPhoto[]) {
  if (photos.length > 5) throw new MarketError('Можно добавить не более 5 фотографий.');
  for (const [position, photo] of photos.entries()) await db.query(`insert into "marketPhoto"("${kind}",position,data,thumbnail) values($1,$2,$3,$4)`, [id, position, photo.data, photo.thumbnail]);
}
export async function createListing(userId: string, input: ListingInput, photos: PreparedReviewPhoto[]) {
  if (!photos.length || photos.length > 5) throw new MarketError('Добавьте от 1 до 5 фотографий.');
  return transaction(async db => {
    await allowed(db, userId); await cooldown(db, userId, 'lastMarketListingAt', 60);
    const quantity = parseQuantity(input.quantity);
    const { rows } = await db.query('insert into "marketListing"("sellerId",title,description,city,price,delivery,quantity,brand,"anyCity") values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [userId, input.title, input.description, input.city, input.price, input.delivery, quantity, input.brand ?? null, input.anyCity ?? false]);
    const id = rows[0].id as string; await savePhotos(db, 'listingId', id, photos); return id;
  });
}
const listingSelect = `select l.*,case when trim(u.name)<>'' and u.name not like '%@%' then u.name else coalesce(u.username,'Участник') end as "sellerName",u.username,
  array(select p.id::text from "marketPhoto" p where p."listingId"=l.id order by position) as photos
  from "marketListing" l join "user" u on u.id=l."sellerId"`;
export async function getListings(page = 1, mine?: string, archive = false, seller?: string, filters: MarketFilters = {}) {
  const { rows } = await getPool().query(`${listingSelect} where l."deletedAt" is null and ($5::text is null or lower(l.brand)=lower($5)) and ($6::text is null or l."anyCity" or lower(l.city)=lower($6)) and ($7::text is null or $7=any(l.delivery)) and ($4::text is null or u.username=$4) and (not $3::boolean or l.closed) and
    ($1::text is not null and l."sellerId"=$1 or $1::text is null and not l.closed and not exists(select 1 from "userBlock" where "userId"=l."sellerId"))
    order by l."createdAt" desc,l.id desc limit 25 offset $2`, [mine ?? null, (page - 1) * 24, Boolean(mine && archive), seller ?? null, filters.brand || null, filters.city || null, filters.delivery || null]);
  return { items: rows.slice(0, 24).map(row => ({ ...row, createdAt: row.createdAt.toISOString() }) as Listing), hasMore: rows.length > 24 };
}
export async function getListing(id: string, viewer?: string, admin = false) {
  marketId(id);
  const { rows } = await getPool().query(`${listingSelect} where l.id=$1 and ($3::boolean or (l."deletedAt" is null and (l."sellerId"=$2 or not exists(select 1 from "userBlock" where "userId"=l."sellerId"))))`, [id, viewer ?? null, admin]);
  return rows[0] ? { ...rows[0], createdAt: rows[0].createdAt.toISOString() } as Listing : null;
}
export async function getActiveOrderId(userId: string, listingId: string): Promise<string | undefined> {
  marketId(listingId);
  const { rows } = await getPool().query(`select id from "marketOrder" where "listingId"=$1 and "buyerId"=$2 and status in ('new','confirmed')`, [listingId, userId]);
  return rows[0]?.id;
}
export async function closeListing(userId: string, id: string) {
  marketId(id);
  const result = await getPool().query('update "marketListing" set closed=true where id=$1 and "sellerId"=$2 returning id', [id, userId]);
  if (!result.rowCount) throw new MarketError('Объявление не найдено или у вас нет доступа.');
}
export async function startOrder(userId: string, listingId: string, requestedQuantity = 1) {
  marketId(listingId);
  const quantity = parseQuantity(requestedQuantity);
  return transaction(async db => {
    await allowed(db, userId);
    const { rows } = await db.query('select * from "marketListing" where id=$1 for update', [listingId]);
    const listing = rows[0];
    if (!listing) throw new MarketError('Объявление не найдено.');
    if (listing.sellerId === userId) throw new MarketError('Нельзя заказать своё объявление.');
    const existing = await db.query(`select id from "marketOrder" where "listingId"=$1 and "buyerId"=$2 and status in ('new','confirmed')`, [listingId, userId]);
    if (existing.rows[0]) return existing.rows[0].id as string;
    if (listing.deletedAt || listing.closed || (await db.query('select 1 from "userBlock" where "userId"=$1', [listing.sellerId])).rowCount) throw new MarketError('Объявление больше недоступно.');
    if (listing.quantity < quantity) throw new MarketError(`Недостаточно товара. Доступно ${listing.quantity} шт.`);
    await cooldown(db, userId, 'lastMarketOrderAt', 10);
    await db.query('update "marketListing" set quantity=quantity-$2 where id=$1', [listingId, quantity]);
    const result = await db.query('insert into "marketOrder"("listingId","buyerId",quantity,"unitPrice","stockReserved") values($1,$2,$3,$4,true) returning id', [listingId, userId, quantity, listing.price]);
    return result.rows[0].id as string;
  });
}
const orderSelect = `select o.*,(o."unitPrice"::bigint*o.quantity)::double precision as price,l."sellerId",l.title,l.city,l.delivery,l.closed,
  case when trim(b.name)<>'' and b.name not like '%@%' then b.name else coalesce(b.username,'Участник') end as "buyerName",
  case when trim(s.name)<>'' and s.name not like '%@%' then s.name else coalesce(s.username,'Участник') end as "sellerName",
  (select count(*)::int from "marketMessage" m where m."orderId"=o.id and m."senderId"<>$1 and m."createdAt">coalesce(case when o."buyerId"=$1 then o."buyerReadAt" else o."sellerReadAt" end,'epoch')) as unread
  from "marketOrder" o join "marketListing" l on l.id=o."listingId" join "user" b on b.id=o."buyerId" join "user" s on s.id=l."sellerId"`;
export async function getOrders(userId: string, page = 1) {
  const { rows } = await getPool().query(`${orderSelect} where (o."buyerId"=$1 or l."sellerId"=$1) order by o."updatedAt" desc,o.id desc limit 31 offset $2`, [userId, (page - 1) * 30]);
  return { items: rows.slice(0, 30).map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }) as MarketOrder), hasMore: rows.length > 30 };
}
export async function getOrder(userId: string, id: string) {
  marketId(id);
  const { rows } = await getPool().query(`${orderSelect} where o.id=$2 and (o."buyerId"=$1 or l."sellerId"=$1)`, [userId, id]);
  return rows[0] ? { ...rows[0], updatedAt: rows[0].updatedAt.toISOString() } as MarketOrder : null;
}
async function lockOrder(db: PoolClient, userId: string, id: string) {
  const { rows } = await db.query(`select o.*,l."sellerId" from "marketOrder" o join "marketListing" l on l.id=o."listingId" where o.id=$1 and (o."buyerId"=$2 or l."sellerId"=$2) for update of o`, [id, userId]);
  if (!rows[0]) throw new MarketError('Переписка недоступна.');
  return rows[0] as { buyerId: string; sellerId: string; listingId: string; quantity: number; stockReserved: boolean; status: OrderStatus };
}
export async function changeOrderStatus(userId: string, id: string, status: OrderStatus) {
  marketId(id);
  return transaction(async db => {
    await allowed(db, userId);
    const order = await lockOrder(db, userId, id);
    if (!canTransitionOrder(order.status, status, order.buyerId === userId ? 'buyer' : 'seller')) throw new MarketError('Этот переход статуса недоступен. Обновите страницу.');
    if (status === 'cancelled' && order.stockReserved) await db.query('update "marketListing" set quantity=quantity+$2 where id=$1', [order.listingId, order.quantity]);
    await db.query(`update "marketOrder" set status=$2,"updatedAt"=clock_timestamp(),"stockReserved"=case when $2='cancelled' then false else "stockReserved" end where id=$1`, [id, status]);
  });
}
export async function sendMarketMessage(userId: string, id: string, text: string, photos: PreparedReviewPhoto[]) {
  marketId(id); text = text.trim();
  if ((!text && !photos.length) || text.length > 4000 || photos.length > 5) throw new MarketError('Напишите сообщение до 4000 символов или добавьте до 5 фотографий.');
  return transaction(async db => {
    await allowed(db, userId);
    await lockOrder(db, userId, id);
    await cooldown(db, userId, 'lastMarketMessageAt', 3);
    const result = await db.query('insert into "marketMessage"("orderId","senderId",text) values($1,$2,$3) returning id', [id, userId, text]);
    await savePhotos(db, 'messageId', result.rows[0].id, photos);
    await db.query('update "marketOrder" set "updatedAt"=clock_timestamp() where id=$1', [id]);
  });
}
export async function getMessages(userId: string, id: string, before?: string) {
  marketId(id); if (before) marketId(before);
  if (!await getOrder(userId, id)) throw new MarketError('Переписка недоступна.');
  const { rows } = await getPool().query(`select m.id,m."senderId",m.text,m."createdAt",
    array(select p.id::text from "marketPhoto" p where p."messageId"=m.id order by position) as photos
    from "marketMessage" m where m."orderId"=$1 and ($2::uuid is null or (m."createdAt",m.id)<(select "createdAt",id from "marketMessage" where id=$2 and "orderId"=$1)) order by m."createdAt" desc,m.id desc limit 51`, [id, before ?? null]);
  return { items: rows.slice(0, 50).reverse().map(row => ({ ...row, createdAt: row.createdAt.toISOString() }) as MarketMessage), hasMore: rows.length > 50 };
}
export async function markMessagesRead(userId: string, id: string, messageId: string) {
  marketId(id); marketId(messageId);
  await getPool().query(`update "marketOrder" o set
    "buyerReadAt"=case when o."buyerId"=$1 then greatest(o."buyerReadAt",m."createdAt") else o."buyerReadAt" end,
    "sellerReadAt"=case when l."sellerId"=$1 then greatest(o."sellerReadAt",m."createdAt") else o."sellerReadAt" end
    from "marketListing" l,"marketMessage" m where o.id=$2 and l.id=o."listingId" and m.id=$3 and m."orderId"=o.id and (o."buyerId"=$1 or l."sellerId"=$1)`, [userId, id, messageId]);
}
export async function getMarketPhoto(id: string, userId: string | null, thumbnail: boolean) {
  marketId(id);
  const { rows } = await getPool().query<{ data: Buffer }>(`select ${thumbnail ? 'p.thumbnail' : 'p.data'} as data from "marketPhoto" p
    left join "marketListing" l on l.id=p."listingId"
    left join "marketMessage" m on m.id=p."messageId"
    left join "marketOrder" o on o.id=m."orderId"
    left join "marketListing" ol on ol.id=o."listingId"
    where p.id=$1 and ((l.id is not null and l."deletedAt" is null and not exists(select 1 from "userBlock" where "userId"=l."sellerId")) or l."sellerId"=$2 or o."buyerId"=$2 or ol."sellerId"=$2 or (l.id is not null and exists(select 1 from "user" au join "siteAdmin" sa on sa.email=lower(au.email) where au.id=$2)))`, [id, userId]);
  return rows[0]?.data;
}

export async function deleteArchivedListing(userId: string, id: string) {
  marketId(id);
  const result = await getPool().query('update "marketListing" set "deletedAt"=now() where id=$1 and "sellerId"=$2 and closed and "deletedAt" is null returning id', [id,userId]);
  if (!result.rowCount) throw new MarketError('Можно удалить только своё закрытое объявление.');
}

export async function getMarketFilterOptions() {
  const { rows } = await getPool().query<{brand:string|null;city:string;anyCity:boolean}>(`select distinct brand,city,"anyCity" from "marketListing" l where not closed and "deletedAt" is null and not exists(select 1 from "userBlock" b where b."userId"=l."sellerId")`);
  return { brands: [...new Set(rows.flatMap(row=>row.brand?[row.brand]:[]))].sort((a,b)=>a.localeCompare(b,'ru')), cities: [...new Set(rows.filter(row=>!row.anyCity).map(row=>row.city))].sort((a,b)=>a.localeCompare(b,'ru')) };
}
