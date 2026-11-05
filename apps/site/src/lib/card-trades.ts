import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { flavorName } from '@/lib/catalog-query';
import {
  OFFERS_PER_DAY, OPEN_OFFERS, TRADE_LOCK_DAYS, TRADE_MIN_DAYS, TRADE_OFFER_HOURS, TRADES_PER_DAY,
  tradeBalance, type TradeCardRef, type TradeSide,
} from '@/lib/card-trade-fields';
import { gachaPool, type GachaDrink } from '@/lib/gacha';
import { days, pluralRu } from '@/lib/drink-calendar-fields';
import { betterRarity, rarityRank, type Rarity } from '@/lib/gacha-fields';

export class TradeError extends Error {}

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const trades = (count: number) => `${count} ${pluralRu(count, 'обмен', 'обмена', 'обменов')}`;
const DAY_START = `(((now() at time zone 'Europe/Moscow')::date)::timestamp at time zone 'Europe/Moscow')`;

export interface TradePlayer { id: string; name: string; username: string | null; avatarId: string | null }
/** A card of a member as the trade screen shows it: copies and whether a recent trade still holds it. */
export interface TradeCard extends GachaDrink { count: number; lockedUntil: string | null }
export interface TradeItem extends GachaDrink { side: TradeSide }
export interface TradeView {
  id: string; status: 'open' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  /** The viewer proposed it. */
  outgoing: boolean;
  partner: TradePlayer;
  /** From the viewer's side: what they give and what they get. */
  give: TradeItem[]; get: TradeItem[];
  createdAt: string; expiresAt: string; decidedAt: string | null;
  /** Whole hours an open offer has left, counted on the server. */
  hoursLeft: number | null;
}

const PLAYER = (column: string) => `(select json_build_object('id', u.id, 'name', u.name, 'username', u.username,
  'avatarId', (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar')) from "user" u where u.id = ${column})`;

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Unanswered offers close after `TRADE_OFFER_HOURS`; done lazily whenever the member's trades are touched. */
async function expireOffers(db: Pick<PoolClient, 'query'>, userId: string) {
  await db.query(`update "cardTrade" set status = 'expired', "decidedAt" = "expiresAt"
    where status = 'open' and "expiresAt" <= now() and ("fromId" = $1 or "toId" = $1)`, [userId]);
}

/**
 * Why these two cannot trade, or `null`. Both need a nickname, no site block, no block between them and an account of
 * `TRADE_MIN_DAYS` days: a fresh fake cannot trade on its first day.
 */
async function tradeRefusal(db: Pick<PoolClient, 'query'>, userId: string, partnerId: string): Promise<string | null> {
  if (userId === partnerId) return 'Со своей коллекцией не меняются.';
  const { rows } = await db.query<{ id: string; username: string | null; blocked: boolean; young: boolean }>(`select u.id, u.username,
      exists(select 1 from "userBlock" b where b."userId" = u.id) as blocked,
      u."createdAt" > now() - make_interval(days => $3) as young
    from "user" u where u.id in ($1, $2)`, [userId, partnerId, TRADE_MIN_DAYS]);
  const me = rows.find(row => row.id === userId);
  const them = rows.find(row => row.id === partnerId);
  if (!me || !them) return 'Участник не найден.';
  if (me.blocked) return 'Аккаунт заблокирован.';
  if (them.blocked || !them.username) return 'С этим участником сейчас нельзя меняться.';
  if (!me.username) return 'Чтобы меняться, задайте ник в настройках профиля.';
  if ((await db.query(`select 1 from "memberBlock" where ("blockerId" = $1 and "blockedId" = $2) or ("blockerId" = $2 and "blockedId" = $1)`, [userId, partnerId])).rowCount) return 'С этим участником нельзя меняться.';
  if (me.young) return `Меняться можно через ${days(TRADE_MIN_DAYS)} после регистрации — так коллекции не перекачивают с новых аккаунтов.`;
  if (them.young) return `Аккаунт @${them.username} ещё новый: меняться можно через ${days(TRADE_MIN_DAYS)} после регистрации.`;
  return null;
}

async function cardsOf(db: Pick<PoolClient, 'query'>, userId: string, lock = false) {
  return (await db.query<{ brand: string; flavor: string; rarity: Rarity; count: number; lockedUntil: Date | null }>(
    `select brand, flavor, rarity, count, "tradeLockedUntil" as "lockedUntil" from "gachaCard" where "userId" = $1${lock ? ' for update' : ''}`, [userId])).rows;
}

const isLocked = (row: { lockedUntil: Date | null }) => Boolean(row.lockedUntil && row.lockedUntil.getTime() > Date.now());

/** The cards of a member that can be traded at all: those the Bankomat still has (they show in the collection). */
function shown(rows: Awaited<ReturnType<typeof cardsOf>>, pool: Map<string, GachaDrink>): TradeCard[] {
  return rows.flatMap(row => {
    const drink = pool.get(key(row.brand, row.flavor));
    return drink ? [{ ...drink, rarity: row.rarity, count: row.count, lockedUntil: isLocked(row) ? row.lockedUntil!.toISOString() : null }] : [];
  }).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru'));
}

export interface TradeDesk {
  mine: TradeCard[]; theirs: TradeCard[];
  /** Why a trade is impossible right now, or null. */
  refusal: string | null;
  /** The open offer between the two, if there is one: a pair has one at a time. */
  open: { id: string; outgoing: boolean } | null;
}

/** Everything the trade screen needs: both collections, and whether the two can trade. */
export async function getTradeDesk(userId: string, partnerId: string, pool?: GachaDrink[]): Promise<TradeDesk> {
  const drinks = new Map((pool ?? await gachaPool()).map(drink => [key(drink.brand, drink.flavor), drink]));
  const db = getPool();
  await expireOffers(db, userId);
  const [mine, theirs, refusal, open] = await Promise.all([
    cardsOf(db, userId), cardsOf(db, partnerId), tradeRefusal(db, userId, partnerId),
    db.query<{ id: string; fromId: string }>(`select id, "fromId" from "cardTrade" where status = 'open'
      and (("fromId" = $1 and "toId" = $2) or ("fromId" = $2 and "toId" = $1)) limit 1`, [userId, partnerId]).then(result => result.rows[0]),
  ]);
  return { mine: shown(mine, drinks), theirs: shown(theirs, drinks), refusal, open: open ? { id: open.id, outgoing: open.fromId === userId } : null };
}

/** Picks the asked cards out of a member's collection: each must be there, not held by a recent trade, and in the Bankomat. */
function pickCards(rows: Awaited<ReturnType<typeof cardsOf>>, refs: readonly TradeCardRef[], pool: Map<string, GachaDrink>, whose: 'mine' | 'theirs'): { brand: string; flavor: string; rarity: Rarity }[] {
  const owned = new Map(rows.map(row => [key(row.brand, row.flavor), row]));
  return refs.map(ref => {
    const row = owned.get(key(ref.brand, ref.flavor));
    const name = pool.get(key(ref.brand, ref.flavor))?.name ?? flavorName(ref.flavor);
    if (!row || !pool.has(key(ref.brand, ref.flavor))) throw new TradeError(whose === 'mine' ? `Карточки «${ref.brand} · ${name}» у вас уже нет.` : `Карточки «${ref.brand} · ${name}» у участника уже нет.`);
    if (isLocked(row)) throw new TradeError(`«${ref.brand} · ${name}» недавно получена в обмене и пока не меняется.`);
    return { brand: row.brand, flavor: row.flavor, rarity: row.rarity };
  });
}

/**
 * A new offer: what the member gives and what they ask from the partner. The cards must be there and the sides
 * worth almost the same (`tradeBalance`); the partner gets a notification and answers on the trades screen.
 */
export async function proposeTrade(userId: string, partnerId: string, give: readonly TradeCardRef[], take: readonly TradeCardRef[], pool?: GachaDrink[]): Promise<{ id: string }> {
  const drinks = new Map((pool ?? await gachaPool()).map(drink => [key(drink.brand, drink.flavor), drink]));
  return transaction(async client => {
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    await expireOffers(client, userId);
    await expireOffers(client, partnerId);
    const refusal = await tradeRefusal(client, userId, partnerId);
    if (refusal) throw new TradeError(refusal);
    const open = (await client.query<{ fromId: string }>(`select "fromId" from "cardTrade" where status = 'open'
      and (("fromId" = $1 and "toId" = $2) or ("fromId" = $2 and "toId" = $1))`, [userId, partnerId])).rows[0];
    if (open) throw new TradeError(open.fromId === userId ? 'Вы уже предложили этому участнику обмен — дождитесь ответа или отмените его.' : 'От этого участника уже есть предложение — сначала ответьте на него.');
    const { outgoing, today } = (await client.query<{ outgoing: number; today: number }>(`select
        count(*) filter (where status = 'open')::int as outgoing,
        count(*) filter (where "createdAt" >= ${DAY_START})::int as today
      from "cardTrade" where "fromId" = $1`, [userId])).rows[0]!;
    if (outgoing >= OPEN_OFFERS) throw new TradeError(`Открытых предложений может быть не больше ${OPEN_OFFERS}: дождитесь ответов или отмените одно.`);
    if (today >= OFFERS_PER_DAY) throw new TradeError(`Сегодня вы уже предложили ${trades(OFFERS_PER_DAY)}. Попробуйте завтра.`);
    const gives = pickCards(await cardsOf(client, userId), give, drinks, 'mine');
    const takes = pickCards(await cardsOf(client, partnerId), take, drinks, 'theirs');
    const balance = tradeBalance(gives.map(card => card.rarity), takes.map(card => card.rarity));
    if (!balance.fair) throw new TradeError('Обмен должен быть почти равным: сравните ценность сторон.');
    const id = (await client.query<{ id: string }>(`insert into "cardTrade"("fromId", "toId", "expiresAt") values ($1, $2, now() + make_interval(hours => $3)) returning id`,
      [userId, partnerId, TRADE_OFFER_HOURS])).rows[0]!.id;
    for (const [side, cards] of [['give', gives], ['take', takes]] as const) {
      for (const card of cards) await client.query('insert into "cardTradeItem"("tradeId", side, brand, flavor, rarity) values ($1, $2, $3, $4, $5)', [id, side, card.brand, card.flavor, card.rarity]);
    }
    await client.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'card-trade', $3, $4) on conflict ("userId", "eventKey") do nothing`,
      [partnerId, userId, `card-trade:${id}`, JSON.stringify({ type: 'offer', give: takes.length, get: gives.length })]);
    return { id };
  });
}

/** Moves one copy of a card from one member to another; the received copy is held by `TRADE_LOCK_DAYS`. */
async function moveCard(client: PoolClient, from: string, to: string, card: { brand: string; flavor: string; rarity: Rarity }) {
  // The last copy leaves the album (the count can never be 0), a duplicate only loses one copy.
  const gone = await client.query('delete from "gachaCard" where "userId" = $1 and brand = $2 and flavor = $3 and count = 1', [from, card.brand, card.flavor]);
  if (!gone.rowCount && !(await client.query('update "gachaCard" set count = count - 1 where "userId" = $1 and brand = $2 and flavor = $3 and count > 1', [from, card.brand, card.flavor])).rowCount) {
    throw new TradeError('Карточки уже нет.');
  }
  const existing = (await client.query<{ rarity: Rarity }>('select rarity from "gachaCard" where "userId" = $1 and brand = $2 and flavor = $3', [to, card.brand, card.flavor])).rows[0];
  const rarity = existing ? betterRarity(existing.rarity, card.rarity) : card.rarity;
  // A trade never gives shards: a received duplicate only adds a copy, or trading would farm shards.
  await client.query(`insert into "gachaCard"("userId", brand, flavor, rarity, "tradeLockedUntil") values ($1, $2, $3, $4, now() + make_interval(days => $5))
    on conflict ("userId", brand, flavor) do update set count = "gachaCard".count + 1, rarity = $4, "lastAt" = now(), "tradeLockedUntil" = excluded."tradeLockedUntil"`,
    [to, card.brand, card.flavor, rarity, TRADE_LOCK_DAYS]);
}

/**
 * The partner's answer. Accepting checks everything again under both members' locks — the cards may have gone into
 * another trade, a rarity may have changed — then moves every card in one transaction.
 */
export async function answerTrade(userId: string, tradeId: string, accept: boolean, pool?: GachaDrink[]): Promise<void> {
  const drinks = new Map((pool ?? await gachaPool()).map(drink => [key(drink.brand, drink.flavor), drink]));
  await transaction(async client => {
    const trade = (await client.query<{ fromId: string; toId: string; status: string; expired: boolean }>(`select "fromId", "toId", status, "expiresAt" <= now() as expired
      from "cardTrade" where id = $1 and "toId" = $2 for update`, [tradeId, userId])).rows[0];
    if (!trade) throw new TradeError('Такого предложения нет.');
    if (trade.status !== 'open' || trade.expired) throw new TradeError('Предложение уже не действует.');
    if (!accept) {
      await client.query(`update "cardTrade" set status = 'declined', "decidedAt" = now() where id = $1`, [tradeId]);
      return;
    }
    // Both members in the same order, so two trades between the same people cannot wait on each other.
    for (const id of [trade.fromId, trade.toId].sort()) await client.query('select 1 from "user" where id = $1 for no key update', [id]);
    const refusal = await tradeRefusal(client, userId, trade.fromId);
    if (refusal) throw new TradeError(refusal);
    const done = (await client.query<{ mine: number; theirs: number; pair: number }>(`select
        count(*) filter (where "fromId" = $1 or "toId" = $1)::int as mine,
        count(*) filter (where "fromId" = $2 or "toId" = $2)::int as theirs,
        count(*) filter (where ("fromId" = $1 and "toId" = $2) or ("fromId" = $2 and "toId" = $1))::int as pair
      from "cardTrade" where status = 'accepted' and "decidedAt" >= ${DAY_START} and ("fromId" in ($1, $2) or "toId" in ($1, $2))`, [userId, trade.fromId])).rows[0]!;
    if (done.pair > 0) throw new TradeError('С этим участником сегодня уже был обмен. Следующий — завтра.');
    if (done.mine >= TRADES_PER_DAY) throw new TradeError(`Сегодня у вас уже ${trades(TRADES_PER_DAY)}. Следующий — завтра.`);
    if (done.theirs >= TRADES_PER_DAY) throw new TradeError(`У участника сегодня уже ${trades(TRADES_PER_DAY)}. Попробуйте завтра.`);
    const items = (await client.query<{ side: TradeSide; brand: string; flavor: string }>('select side, brand, flavor from "cardTradeItem" where "tradeId" = $1', [tradeId])).rows;
    const gives = pickCards(await cardsOf(client, trade.fromId, true), items.filter(item => item.side === 'give'), drinks, 'theirs');
    const takes = pickCards(await cardsOf(client, userId, true), items.filter(item => item.side === 'take'), drinks, 'mine');
    if (!tradeBalance(gives.map(card => card.rarity), takes.map(card => card.rarity)).fair) throw new TradeError('Редкость карточек изменилась, и обмен больше не равный.');
    for (const card of gives) await moveCard(client, trade.fromId, userId, card);
    for (const card of takes) await moveCard(client, userId, trade.fromId, card);
    await client.query(`update "cardTrade" set status = 'accepted', "decidedAt" = now() where id = $1`, [tradeId]);
    await client.query(`insert into notification("userId", "actorId", kind, "eventKey", payload) values ($1, $2, 'card-trade', $3, $4) on conflict ("userId", "eventKey") do nothing`,
      [trade.fromId, userId, `card-trade-done:${tradeId}`, JSON.stringify({ type: 'accepted', give: gives.length, get: takes.length })]);
  });
}

/** The one who proposed takes the offer back. */
export async function cancelTrade(userId: string, tradeId: string): Promise<void> {
  const { rowCount } = await getPool().query(`update "cardTrade" set status = 'cancelled', "decidedAt" = now() where id = $1 and "fromId" = $2 and status = 'open'`, [tradeId, userId]);
  if (!rowCount) throw new TradeError('Предложение уже не действует.');
}

/** Offers that wait for the member's answer — the badge on the collection. */
export async function incomingTrades(userId: string): Promise<number> {
  return (await getPool().query<{ n: number }>(`select count(*)::int as n from "cardTrade" where "toId" = $1 and status = 'open' and "expiresAt" > now()`, [userId])).rows[0]?.n ?? 0;
}

/** The trades screen: open offers both ways and the latest decided ones, each from the viewer's side. */
export async function listTrades(userId: string, pool?: GachaDrink[]): Promise<TradeView[]> {
  const drinks = new Map((pool ?? await gachaPool()).map(drink => [key(drink.brand, drink.flavor), drink]));
  const db = getPool();
  await expireOffers(db, userId);
  const { rows } = await db.query<{ id: string; status: TradeView['status']; fromId: string; partner: TradePlayer; createdAt: Date; expiresAt: Date; decidedAt: Date | null;
    items: { side: TradeSide; brand: string; flavor: string; rarity: Rarity }[] }>(`
    select t.id, t.status, t."fromId", t."createdAt", t."expiresAt", t."decidedAt",
      ${PLAYER(`case when t."fromId" = $1 then t."toId" else t."fromId" end`)} as partner,
      (select json_agg(json_build_object('side', i.side, 'brand', i.brand, 'flavor', i.flavor, 'rarity', i.rarity)) from "cardTradeItem" i where i."tradeId" = t.id) as items
    from "cardTrade" t where t."fromId" = $1 or t."toId" = $1
    order by (t.status = 'open') desc, coalesce(t."decidedAt", t."createdAt") desc limit 40`, [userId]);
  return rows.map(row => {
    const outgoing = row.fromId === userId;
    const items = (row.items ?? []).map(item => {
      const drink = drinks.get(key(item.brand, item.flavor));
      // A can that left the Bankomat still shows by name, without a cover.
      return { ...(drink ?? { brand: item.brand, flavor: item.flavor, name: flavorName(item.flavor), cover: '', href: '' }), rarity: item.rarity, side: item.side };
    });
    return {
      id: row.id, status: row.status, outgoing, partner: row.partner,
      give: items.filter(item => (item.side === 'give') === outgoing), get: items.filter(item => (item.side === 'take') === outgoing),
      createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null,
      hoursLeft: row.status === 'open' ? Math.max(1, Math.round((row.expiresAt.getTime() - Date.now()) / 3600_000)) : null,
    };
  });
}

/** Whom to trade with: people the member follows who have cards, those with bigger collections first. */
export async function tradePartners(userId: string): Promise<(TradePlayer & { cards: number })[]> {
  const { rows } = await getPool().query<TradePlayer & { cards: number }>(`
    select u.id, u.name, u.username, (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId",
      (select count(*) from "gachaCard" c where c."userId" = u.id)::int as cards
    from "userFollow" f join "user" u on u.id = f."targetId"
    where f."userId" = $1 and u.username is not null
      and exists(select 1 from "gachaCard" c where c."userId" = u.id)
      and not exists(select 1 from "userBlock" x where x."userId" = u.id)
      and not exists(select 1 from "memberBlock" m where (m."blockerId" = $1 and m."blockedId" = u.id) or (m."blockerId" = u.id and m."blockedId" = $1))
    order by cards desc, u."lastSeenAt" desc nulls last limit 12`, [userId]);
  return rows;
}
