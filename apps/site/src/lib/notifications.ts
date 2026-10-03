import { getPool } from '@/db/pool';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { activeOffers, type CatalogFile } from '@/lib/catalog-files';
import { isResolvedFlavor, type CityId } from '@canrush/shared';

export interface NotificationItem { id: string; title: string; detail: string; href: string; unread: boolean; createdAt: string; kind: string; city?: string }
const money = (kopecks: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(kopecks / 100) + ' ₽';

/** First observation is a baseline. Only fresh newer snapshots of the same city/volume are compared. */
export async function syncFavoritePrices(userId: string, city: { id: CityId; name: string }, snapshot: CatalogFile | null) {
  if (snapshot?.cityId && snapshot.cityId !== city.id) return;
  if (!snapshot?.generatedAt || snapshot.status === 'stale' || snapshot.status === 'unavailable') return;
  const stamp = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(stamp) || stamp < Date.now() - 86400000 || stamp > Date.now() + 60000) return;
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['favorite-prices',userId,city.id])]);
    const favorites = await client.query<{brand:string;flavor:string}>('select brand,flavor from favorite where "userId"=$1 for key share', [userId]);
    const keys = new Set(favorites.rows.map(f => JSON.stringify([f.brand,f.flavor])));
    const previous = await client.query<{brand:string;flavor:string;volume:number;price:number;snapshotAt:Date}>('select * from "favoritePriceWatch" where "userId"=$1 and city=$2', [userId,city.id]);
    const saved = new Map(previous.rows.map(row => [JSON.stringify([row.brand,row.flavor,row.volume]),row]));
    for (const group of activeOffers(snapshot.groups ?? [])) {
      if (!isResolvedFlavor(group.flavor) || !keys.has(JSON.stringify([group.brand,group.flavor]))) continue;
      const prices = new Map<number,number>();
      for (const offer of group.variants) {
        if (offer.stale || !offer.volumeMl || !Number.isSafeInteger(offer.volumeMl) || offer.volumeMl <= 0) continue;
        const price = Math.round(offer.price * 100);
        if (!Number.isSafeInteger(price) || price <= 0 || price > 2147483647) continue;
        prices.set(offer.volumeMl, Math.min(prices.get(offer.volumeMl) ?? Infinity,price));
      }
      for (const [volume,price] of prices) {
        const before = saved.get(JSON.stringify([group.brand,group.flavor,volume]));
        if (before && before.snapshotAt.getTime() >= stamp) continue;
        if (before && before.price !== price) {
          await client.query(`insert into notification ("userId",kind,"eventKey",payload) values ($1,'price',$2,$3::jsonb) on conflict do nothing`, [userId,JSON.stringify(['price',city.id,group.brand,group.flavor,volume,snapshot.generatedAt]),JSON.stringify({brand:group.brand,flavor:group.flavor,volume,city:city.id,cityName:city.name,before:before.price,price})]);
        }
        await client.query(`insert into "favoritePriceWatch" ("userId",brand,flavor,city,volume,price,"snapshotAt") values ($1,$2,$3,$4,$5,$6,$7)
          on conflict ("userId",brand,flavor,city,volume) do update set price=excluded.price,"snapshotAt"=excluded."snapshotAt"`, [userId,group.brand,group.flavor,city.id,volume,price,snapshot.generatedAt]);
      }
    }
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export async function getNotifications(userId: string, before?: string) {
  const [unread, result] = await Promise.all([
    getPool().query('select count(*)::int as count from notification where "userId"=$1 and "readAt" is null',[userId]),
    getPool().query(`select n.*,u.name,u.username,r.brand,r.flavor,c.text as comment,w.text as wall,
      owner.username as "ownerUsername" from notification n
      left join "user" u on u.id=n."actorId" left join review r on r.id=n."reviewId"
      left join "reviewComment" c on c.id=n."commentId" left join "profileComment" w on w.id=n."wallId"
      join "user" owner on owner.id=n."userId"
      where n."userId"=$1 and ($2::uuid is null or (n."createdAt",n.id)<(select "createdAt",id from notification where id=$2 and "userId"=$1))
      order by n."createdAt" desc,n.id desc limit 21`,[userId,before ?? null]),
  ]);
  const items: NotificationItem[] = result.rows.slice(0,20).map(row => {
    const actor = row.username ? `@${row.username}` : row.name && !row.name.includes('@') ? row.name : 'Участник';
    let title = `${actor} подписался на вас`;
    let detail = ''; let href = row.username ? `/profile/${encodeURIComponent(row.username)}` : '/profile'; let city: string | undefined;
    if (row.kind==='like' || row.kind==='review-comment') {
      title = row.kind==='like' ? `${actor} поставил лайк вашему отзыву` : `${actor} прокомментировал ваш отзыв`;
      detail = `${row.brand} · ${flavorName(row.flavor)}${row.comment ? ' — '+row.comment.slice(0,160) : ''}`;
      href = `/catalog/${catalogGroupSlug(row.brand,row.flavor)}?tab=reviews#review-${row.reviewId}`;
    } else if (row.kind==='wall-comment') {
      title = `${actor} оставил запись на вашей стене`; detail = row.wall?.slice(0,160) ?? '';
      href = row.ownerUsername ? `/profile/${encodeURIComponent(row.ownerUsername)}#wall` : '/profile#wall';
    } else if (row.kind==='price') {
      const p = row.payload; city = p.city;
      title = `${p.price < p.before ? 'Цена снизилась' : 'Цена выросла'}: ${p.brand} · ${flavorName(p.flavor)}`;
      detail = `${p.cityName} · ${p.volume} мл · ${money(p.before)} → ${money(p.price)}`;
      href = `/catalog/${catalogGroupSlug(p.brand,p.flavor)}`;
    }
    return { id:row.id,kind:row.kind,title,detail,href,city,unread:!row.readAt,createdAt:row.createdAt.toISOString() };
  });
  return { items, unread: unread.rows[0]?.count ?? 0, hasMore:result.rows.length > 20 };
}
export async function readNotifications(userId: string, id?: string) {
  await getPool().query('update notification set "readAt"=coalesce("readAt",now()) where "userId"=$1 and ($2::uuid is null or id=$2) and "readAt" is null',[userId,id ?? null]);
}
