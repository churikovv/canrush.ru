import { getPool } from '@/db/pool';
import { HUNT_LEVELS, HuntError, huntLevelReached, huntPhase, huntProgress, parseHuntOrder, type HuntEvent, type HuntOrderInput, type HuntPayout } from '@/lib/hunt-fields';
import type { HuntOrderView, HuntStoreView, HuntView } from '@/lib/hunt-gaps';
import { openPayout, sealPayout } from '@/lib/hunt-payout';

export type { HuntView } from '@/lib/hunt-gaps';

interface Queryable { query: ReturnType<typeof getPool>['query'] }

/** Событие на экране: идущее или ближайшее, а если впереди ничего нет — последнее прошедшее. Новое событие — строка `huntEvent`. */
export async function getHuntEvent(db: Queryable = getPool(), now = Date.now()): Promise<HuntEvent> {
  const row = (await db.query<{ key: string; startsAt: Date; endsAt: Date; reviewUntil: Date; burnsAt: Date; memberLimit: number }>(`select key, "startsAt", "endsAt", "reviewUntil", "burnsAt", "memberLimit" from "huntEvent"
    order by "burnsAt" > to_timestamp($1::double precision / 1000) desc, case when "burnsAt" > to_timestamp($1::double precision / 1000) then "startsAt" end asc, "startsAt" desc limit 1`, [now])).rows[0];
  if (!row) throw new Error('Price tag hunt has no event');
  return { key: row.key, memberLimit: row.memberLimit, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), reviewUntil: row.reviewUntil.toISOString(), burnsAt: row.burnsAt.toISOString() };
}

/** Баннер и подсказка в форме магазина — только пока приём открыт. */
export async function huntOpenEvent(now = Date.now()) {
  const event = await getHuntEvent(getPool(), now);
  return huntPhase(event, now) === 'open' ? event : null;
}

async function rewardsOf(db: Queryable, userId: string, event: HuntEvent) {
  return (await db.query<{ storeId: string; reason: string; amount: number; level: number | null; claimedAt: Date | null }>(`select "storeId", reason, amount, level, "claimedAt" from "huntReward"
    where "userId" = $1 and event = $2 order by "createdAt", reason`, [userId, event.key])).rows;
}

/** Баланс события: с его начала; после сгорания — ноль. Журнал не трогаем, так что следующее событие просто считает с нуля. */
async function balanceOf(db: Queryable, userId: string, event: HuntEvent, now: number) {
  if (huntPhase(event, now) === 'over') return 0;
  return (await db.query<{ balance: number }>('select coalesce(sum(amount), 0)::int as balance from "huntLedger" where "userId" = $1 and "createdAt" >= $2', [userId, event.startsAt])).rows[0]?.balance ?? 0;
}

/** Свои магазины: сколько в них цен, есть ли фото и точка и сколько ценников они уже принесли. Цены считает так же, как триггер. */
async function ownStores(db: Queryable, userId: string) {
  return (await db.query<HuntStoreView>(`select s.id, s.name, s.status,
      (select coalesce(sum(amount), 0)::int from "huntReward" where "storeId" = s.id and reason <> 'bonus') as earned,
      (select count(*)::int from jsonb_array_elements(s.catalog) item where coalesce((item->>'price')::numeric, 0) > 0 and item->>'availability' is distinct from 'unavailable') as prices,
      exists(select 1 from "storePhoto" where "storeId" = s.id) as photo, s.latitude is not null as located
    from "marketStore" s where s."ownerId" = $1 and s.status <> 'rejected' order by s."createdAt" desc limit 30`, [userId])).rows;
}

async function ownOrders(db: Queryable, userId: string) {
  return (await db.query<HuntOrderView>(`select id, item, amount, status, note, to_char("createdAt" at time zone 'Europe/Moscow', 'DD.MM.YYYY') as "createdAt"
    from "huntOrder" where "userId" = $1 order by "createdAt" desc limit 20`, [userId])).rows;
}

/** Экран охоты; гостю — та же дорожка без прогресса. */
export async function getHunt(userId: string | null, now = Date.now()): Promise<HuntView> {
  const db = getPool();
  const event = await getHuntEvent(db, now);
  const phase = huntPhase(event, now);
  const [rewards, balance, orders, stores] = await Promise.all([userId ? rewardsOf(db, userId, event) : [], userId ? balanceOf(db, userId, event, now) : 0, userId ? ownOrders(db, userId) : [], userId ? ownStores(db, userId) : []]);
  const network = rewards.filter(row => row.reason === 'full' || row.reason === 'upgrade').length;
  const reached = huntLevelReached(network);
  const earned = rewards.reduce((sum, row) => sum + row.amount, 0);
  const waiting = phase === 'over' ? [] : rewards.filter(row => !row.claimedAt);
  const claimed = new Set(rewards.flatMap(row => (row.level && row.claimedAt ? [row.level] : [])));
  return {
    event, phase, network, reached, balance, limitLeft: Math.max(0, event.memberLimit - earned), progress: huntProgress(network),
    ready: { count: waiting.length, amount: waiting.reduce((sum, row) => sum + row.amount, 0) },
    levels: HUNT_LEVELS.map((level, index) => ({ ...level, level: index + 1, reached: index < reached, claimed: claimed.has(index + 1) })), orders, stores,
  };
}

async function assertAllowed(db: Queryable, userId: string) {
  if ((await db.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new HuntError('Аккаунт заблокирован.');
}

/** Забрать всё начисленное: лимит занят ещё при проверке магазина, поэтому здесь только перенос на баланс. */
export async function claimHunt(userId: string, now = Date.now()): Promise<{ amount: number }> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    await assertAllowed(client, userId);
    const event = await getHuntEvent(client, now);
    if (huntPhase(event, now) === 'over') throw new HuntError('Событие завершено, ценники сгорели.');
    const rewards = (await rewardsOf(client, userId, event)).filter(row => !row.claimedAt);
    if (!rewards.length) throw new HuntError('Новых наград пока нет.');
    for (const reward of rewards) {
      await client.query(`update "huntReward" set "claimedAt" = now() where "storeId" = $1 and reason = $2`, [reward.storeId, reward.reason]);
      await client.query(`insert into "huntLedger"("userId", reason, "sourceKey", amount) values ($1, 'reward', $2, $3)`, [userId, `${reward.storeId}:${reward.reason}`, reward.amount]);
    }
    await client.query('commit');
    return { amount: rewards.reduce((sum, row) => sum + row.amount, 0) };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Заявка на обмен: ценники списываются сразу, отменённая заявка возвращает их целиком. Открытая заявка у участника одна. */
export async function createHuntOrder(userId: string, input: HuntOrderInput, now = Date.now()): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    await assertAllowed(client, userId);
    const event = await getHuntEvent(client, now);
    const phase = huntPhase(event, now);
    if (phase === 'over') throw new HuntError('Событие завершено, ценники сгорели.');
    const { item, amount, payout } = parseHuntOrder(input, phase);
    if ((await client.query(`select 1 from "huntOrder" where "userId" = $1 and status = 'new'`, [userId])).rowCount) throw new HuntError('Сначала дождитесь ответа по открытой заявке.');
    if (await balanceOf(client, userId, event, now) < amount) throw new HuntError('Не хватает ценников.');
    const id = (await client.query<{ id: string }>('insert into "huntOrder"("userId", item, amount, payout) values ($1, $2, $3, $4) returning id', [userId, item.key, amount, payout ? sealPayout(payout) : null])).rows[0]!.id;
    await client.query(`insert into "huntLedger"("userId", reason, "sourceKey", amount) values ($1, 'order', $2, $3)`, [userId, id, -amount]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export interface HuntAdminOrder {
  id: string; item: string; amount: number; status: 'new' | 'done' | 'cancelled'; note: string; createdAt: Date; decidedAt: Date | null;
  userId: string | null; username: string | null; name: string | null; email: string | null; stores: number; earned: number; telegram: boolean;
  /** Реквизиты открытой заявки; `false`, если их не удалось расшифровать. После решения их уже нет. */
  payout: HuntPayout | false | null;
}

/** Очередь команды: открытые сверху, старые первыми; у участника — сколько его магазинов опубликовано и сколько ценников они принесли. */
export async function listHuntOrders(): Promise<HuntAdminOrder[]> {
  const { rows } = await getPool().query<Omit<HuntAdminOrder, 'payout'> & { payout: string | null }>(`select o.id, o.item, o.amount, o.status, o.note, o."createdAt", o."decidedAt", o."userId", o.payout, u.username, u.name, u.email,
      (select count(*)::int from "marketStore" where "ownerId" = o."userId" and status = 'published') as stores,
      (select coalesce(sum(amount), 0)::int from "huntReward" where "userId" = o."userId") as earned,
      exists(select 1 from account a join "telegramChat" c on c."telegramId"::text = a."accountId" where a."userId" = o."userId" and a."providerId" = 'telegram' and c."blockedAt" is null) as telegram
    from "huntOrder" o left join "user" u on u.id = o."userId"
    order by o.status = 'new' desc, case when o.status = 'new' then o."createdAt" end asc, o."createdAt" desc limit 100`);
  return rows.map(row => ({ ...row, payout: row.payout ? openPayout(row.payout) ?? false : null }));
}

/** Сколько ценников начислено в событии, для шапки админки. */
export async function huntIssued() {
  const db = getPool();
  const event = await getHuntEvent(db);
  const issued = (await db.query<{ issued: number }>('select coalesce(sum(amount), 0)::int as issued from "huntReward" where event = $1', [event.key])).rows[0]?.issued ?? 0;
  return { event, issued };
}

/** Решение команды по заявке: «выполнена» или отмена с возвратом ценников. Реквизиты стираются, участник получает уведомление, всё пишется в журнал. */
export async function decideHuntOrder(adminEmail: string, id: string, status: 'done' | 'cancelled', note: string): Promise<void> {
  const reason = note.trim().slice(0, 300);
  if (status === 'cancelled' && !reason) throw new HuntError('Для отмены укажите причину.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const order = (await client.query<{ userId: string | null; item: string; amount: number }>(`update "huntOrder" set status = $2, note = $3, payout = null, "decidedAt" = now(), "decidedBy" = $4
      where id = $1 and status = 'new' returning "userId", item, amount`, [id, status, reason, adminEmail])).rows[0];
    if (!order) throw new HuntError('Заявка уже решена.');
    if (order.userId) {
      if (status === 'cancelled') await client.query(`insert into "huntLedger"("userId", reason, "sourceKey", amount) values ($1, 'refund', $2, $3)`, [order.userId, id, order.amount]);
      await client.query(`insert into notification ("userId", kind, "eventKey", payload) values ($1, 'hunt-order', $2, $3) on conflict do nothing`,
        [order.userId, `hunt-order:${id}`, JSON.stringify({ item: order.item, amount: order.amount, status, note: reason })]);
    }
    await client.query(`insert into "adminAuditLog" ("adminEmail", action, "targetType", "targetId") values ($1, $2, 'hunt-order', $3)`, [adminEmail, `hunt-order-${status}`, id]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
