import { randomInt, randomUUID } from 'node:crypto';
import { CITIES, type CatalogGroup } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { activeOffers, readCityCatalog } from '@/lib/catalog-files';
import { withCardEdits } from '@/lib/catalog-card-edits';
import { catalogDrinkGroups, catalogDrinkGroupsByOrigin } from '@/lib/catalog-drinks';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { moscowDay } from '@/lib/drink-calendar-fields';
import { loadQuestBoard } from '@/lib/gacha-quests';
import { questReward, questSourceKey, type QuestBoard, type QuestClaim } from '@/lib/gacha-quests-fields';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import {
  CRAFT_COST, DUPE_SHARDS, LEGENDARY_DRINKS, MAIN_BANNER, PULL_COST, RARITIES, TEN_PULL_COST, WELCOME_CAPS,
  activeBanner, bannerEndsLabel, isSeasonStar, nextPity, rollCosmetic, pickFromPool, rarityOf, rollRarity, type PityState, type Rarity,
} from '@/lib/gacha-fields';

export class GachaError extends Error {}

export interface GachaDrink { brand: string; flavor: string; name: string; cover: string; href: string; rarity: Rarity; /** Средняя цена банки в магазинах */ price?: number | null }

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const roll = (max: number) => randomInt(max);

let poolCache: { at: number; pool: GachaDrink[] } | null = null;
const POOL_TTL = 10 * 60 * 1000;

/**
 * Пул автомата — весь каталог с фото (в магазинах, архив, напитки участников и компаний), редкость — из настоящих
 * данных: сколько сетей продают напиток во всех городах сейчас. Считается раз в 10 минут на процесс.
 */
export async function gachaPool(): Promise<GachaDrink[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL) return poolCache.pool;
  const [groups, cities, active, origin] = await Promise.all([
    loadAllCatalogGroups(),
    Promise.all(CITIES.map(city => readCityCatalog(city.id))),
    catalogDrinkGroups({ archived: false }).catch(() => [] as CatalogGroup[]),
    catalogDrinkGroupsByOrigin().catch(() => ({ brands: [] as CatalogGroup[], members: [] as CatalogGroup[] })),
  ]);
  const retailers = new Map<string, Set<string>>();
  const prices = new Map<string, number[]>();
  for (const group of await withCardEdits(cities.flatMap(file => activeOffers(file?.groups ?? [])))) {
    const id = key(group.brand, group.flavor);
    const set = retailers.get(id) ?? new Set<string>();
    const paid = prices.get(id) ?? [];
    for (const offer of group.variants) { set.add(offer.retailer ?? offer.source); if (offer.price) paid.push(offer.price); }
    retailers.set(id, set);
    prices.set(id, paid);
  }
  const middle = (values: number[] = []) => (values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]! : null);
  const members = new Set(origin.members.map(group => key(group.brand, group.flavor)));
  const live = new Set(active.map(group => key(group.brand, group.flavor)));
  const memberDrink = (group: CatalogGroup) => group.coverImageUrl?.startsWith('/api/catalog-drinks/') ?? false;
  const manual = new Set(LEGENDARY_DRINKS.map(([brand, flavor]) => key(brand, flavor)));
  const pool = groups
    .filter(group => isCountedCatalogDrink(group) && group.coverImageUrl?.startsWith('/'))
    .map(group => {
      const id = key(group.brand, group.flavor);
      const fromMember = memberDrink(group);
      return {
        brand: group.brand, flavor: group.flavor, name: flavorName(group.flavor), cover: group.coverImageUrl!,
        href: `/catalog/${catalogGroupSlug(group.brand, group.flavor)}`, price: middle(prices.get(id)),
        rarity: rarityOf({
          retailers: retailers.get(id)?.size ?? 0,
          member: members.has(id),
          discontinued: fromMember && !live.has(id),
          manual: manual.has(id),
        }),
      };
    });
  poolCache = { at: Date.now(), pool };
  return pool;
}

/** Для тестов: следующий вызов соберёт пул заново. */
export function resetGachaPool(pool?: GachaDrink[]) { poolCache = pool ? { at: Date.now(), pool } : null; }

interface Queryable { query: ReturnType<typeof getPool>['query'] }

async function balanceOf(db: Queryable, userId: string): Promise<number> {
  return (await db.query<{ caps: number }>('select coalesce(sum(amount), 0)::int as caps from "capLedger" where "userId" = $1', [userId])).rows[0]?.caps ?? 0;
}

async function pityOf(db: Queryable, userId: string): Promise<PityState> {
  const row = (await db.query<{ epic: number; legendary: number }>(`select
      (select count(*) from "gachaPull" p where p."userId" = $1 and p."createdAt" > coalesce((select max("createdAt") from "gachaPull" where "userId" = $1 and rarity in ('epic','legendary')), '-infinity'))::int as epic,
      (select count(*) from "gachaPull" p where p."userId" = $1 and p."createdAt" > coalesce((select max("createdAt") from "gachaPull" where "userId" = $1 and rarity = 'legendary'), '-infinity'))::int as legendary`, [userId])).rows[0];
  return { sinceEpic: row?.epic ?? 0, sinceLegendary: row?.legendary ?? 0 };
}

const freeTodaySql = `not exists(select 1 from "gachaPull" where "userId" = $1 and "freeDay" = (now() at time zone 'Europe/Moscow')::date)`;

async function shardsOf(db: Queryable, userId: string): Promise<number> {
  return (await db.query<{ shards: number }>('select coalesce(sum(amount), 0)::int as shards from "shardLedger" where "userId" = $1', [userId])).rows[0]?.shards ?? 0;
}

async function giftSpinsOf(db: Queryable, userId: string): Promise<number> {
  return (await db.query<{ spins: number }>('select coalesce(sum(amount), 0)::int as spins from "spinLedger" where "userId" = $1', [userId])).rows[0]?.spins ?? 0;
}

/** Колечки из побед в «Битве банок»: собираются в подарочные крутки. */
export async function ringsOf(db: Queryable, userId: string): Promise<number> {
  return (await db.query<{ rings: number }>('select coalesce(sum(amount), 0)::int as rings from "ringLedger" where "userId" = $1', [userId])).rows[0]?.rings ?? 0;
}

export interface GachaState {
  caps: number; shards: number; free: boolean; pity: PityState; cards: number; blocked: boolean;
  /** Колечки из побед в бою */
  rings: number;
  /** Идёт незаконченный бой: автомат зовёт в него вернуться */
  inBattle: boolean;
  /** Подарочные крутки из раздач в ленте: тратятся после бесплатной крутки дня, раньше крышек */
  gifted: number;
  /** Задания дня: что сделано и какие награды забраны */
  quests: QuestBoard;
  /** Идущий сезонный баннер и эксклюзив: получен ли, сколько круток до его гаранта */
  banner: { key: string; title: string; subtitle: string; ends: string; cosmetic: { title: string; note: string; chance: number; owned: boolean; left: number } | null } | null;
}

/** Состояние автомата для участника. Первый заход дарит стартовые крышки — на три крутки. */
export async function getGachaState(userId: string, now = Date.now()): Promise<GachaState> {
  const pool = getPool();
  const banner = activeBanner(now);
  await pool.query(`select award_caps($1, 'welcome', 'welcome', $2, null)`, [userId, WELCOME_CAPS]);
  const [caps, shards, gifted, rings, pity, quests, row] = await Promise.all([
    balanceOf(pool, userId), shardsOf(pool, userId), giftSpinsOf(pool, userId), ringsOf(pool, userId), pityOf(pool, userId), loadQuestBoard(pool, userId, moscowDay(new Date(now))),
    pool.query<{ free: boolean; cards: number; blocked: boolean; owned: boolean; pulled: number; inBattle: boolean }>(`select ${freeTodaySql} as free,
      exists(select 1 from "battle" where "userId" = $1 and status = 'active') as "inBattle",
      (select count(*) from "gachaCard" where "userId" = $1)::int as cards,
      exists(select 1 from "userBlock" where "userId" = $1) as blocked,
      exists(select 1 from "gachaCosmetic" where "userId" = $1 and key = $2) as owned,
      (select count(*) from "gachaPull" where "userId" = $1 and banner = $3)::int as pulled`, [userId, banner?.cosmetic?.key ?? '', banner?.key ?? '']),
  ]);
  const data = row.rows[0];
  return {
    caps, shards, gifted, rings, quests, pity, free: data?.free ?? false, cards: data?.cards ?? 0, blocked: data?.blocked ?? false, inBattle: data?.inBattle ?? false,
    banner: banner ? {
      key: banner.key, title: banner.title, subtitle: banner.subtitle, ends: bannerEndsLabel(banner),
      cosmetic: banner.cosmetic ? { title: banner.cosmetic.title, note: banner.cosmetic.note, chance: banner.cosmetic.odds / 10, owned: data?.owned ?? false, left: Math.max(1, banner.cosmetic.pity - (data?.pulled ?? 0)) } : null,
    } : null,
  };
}

export interface PulledCard extends GachaDrink { pity: boolean; isNew: boolean; count: number; shards: number; star: boolean }
export interface PullResult { cards: PulledCard[]; cosmetic: { key: string; title: string } | null; state: GachaState }

/**
 * Крутка ×1 (бесплатная дня, потом подарочная, потом за крышки) или ×10. Одна транзакция под блокировкой участника: списать
 * крышки, выбрать редкость (с гарантом) и банку, записать крутки и карточки, за дубли — осколки. Пока идёт сезонный
 * баннер, крутка идёт на нём: звёзды сезона выпадают чаще, а с каждой крутки может упасть эксклюзив. Клиент ничего
 * не решает — только показывает.
 */
export async function pullGacha(userId: string, times: 1 | 10, pool?: GachaDrink[], now = Date.now()): Promise<PullResult> {
  const drinks = pool ?? await gachaPool();
  if (!drinks.length) throw new GachaError('Автомат пуст — каталог ещё загружается. Попробуйте позже.');
  const banner = activeBanner(now);
  const weight = (drink: GachaDrink) => (isSeasonStar(banner, drink) ? banner!.boost : 1);
  const client = await getPool().connect();
  const cards: PulledCard[] = [];
  let cosmetic: PullResult['cosmetic'] = null;
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new GachaError('Аккаунт заблокирован.');
    const free = times === 1 && Boolean((await client.query<{ free: boolean }>(`select ${freeTodaySql} as free`, [userId])).rows[0]?.free);
    const gift = times === 1 && !free && await giftSpinsOf(client, userId) > 0;
    const cost = free || gift ? 0 : times === 1 ? PULL_COST : TEN_PULL_COST;
    if (cost && await balanceOf(client, userId) < cost) throw new GachaError(`Не хватает крышек: нужно ${cost}.`);
    const batch = randomUUID();
    let pity = await pityOf(client, userId);
    const season = banner?.cosmetic ? (await client.query<{ owned: boolean; pulled: number }>(`select
        exists(select 1 from "gachaCosmetic" where "userId" = $1 and key = $2) as owned,
        (select count(*) from "gachaPull" where "userId" = $1 and banner = $3)::int as pulled`, [userId, banner.cosmetic.key, banner.key])).rows[0]! : null;
    for (let index = 0; index < times; index++) {
      const rolled = rollRarity(roll, pity);
      const drink = pickFromPool(drinks, rolled.rarity, roll, weight)!;
      pity = nextPity(pity, drink.rarity);
      if (banner?.cosmetic && season && !cosmetic && rollCosmetic(roll, banner, season.owned, season.pulled + index)) {
        await client.query('insert into "gachaCosmetic"("userId", key, banner) values ($1, $2, $3) on conflict do nothing', [userId, banner.cosmetic.key, banner.key]);
        cosmetic = { key: banner.cosmetic.key, title: banner.cosmetic.title };
        season.owned = true;
      }
      // One timestamp per card keeps the order of a batch, which the pity count reads back.
      const pull = (await client.query<{ id: string }>(`insert into "gachaPull"("userId", batch, banner, brand, flavor, rarity, pity, "freeDay", "createdAt")
        values ($1, $2, $3, $4, $5, $6, $7, case when $8 then (now() at time zone 'Europe/Moscow')::date end, clock_timestamp()) returning id`,
        [userId, batch, banner?.key ?? MAIN_BANNER, drink.brand, drink.flavor, drink.rarity, rolled.pity, free])).rows[0]!;
      const card = (await client.query<{ count: number; rarity: Rarity }>(`insert into "gachaCard"("userId", brand, flavor, rarity) values ($1, $2, $3, $4)
        on conflict ("userId", brand, flavor) do update set count = "gachaCard".count + 1, "lastAt" = now(),
          rarity = case when array_position(array['common','rare','epic','legendary'], excluded.rarity) > array_position(array['common','rare','epic','legendary'], "gachaCard".rarity) then excluded.rarity else "gachaCard".rarity end
        returning count, rarity`, [userId, drink.brand, drink.flavor, drink.rarity])).rows[0]!;
      const shards = card.count > 1 ? DUPE_SHARDS[drink.rarity] : 0;
      if (shards) await client.query(`insert into "shardLedger"("userId", reason, "sourceKey", amount) values ($1, 'dupe', $2, $3)`, [userId, pull.id, shards]);
      cards.push({ ...drink, pity: rolled.pity, isNew: card.count === 1, count: card.count, shards, star: isSeasonStar(banner, drink) });
    }
    if (cost) await client.query(`insert into "capLedger"("userId", reason, "sourceKey", amount) values ($1, 'pull', $2, $3)`, [userId, batch, -cost]);
    if (gift) await client.query(`insert into "spinLedger"("userId", reason, "sourceKey", amount) values ($1, 'pull', $2, -1)`, [userId, batch]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return { cards, cosmetic, state: await getGachaState(userId, now) };
}

/**
 * Забрать награду задания дня или бонус за все задания. Выполнение сервер считает сам, под блокировкой участника, а ключ
 * журнала `<день>:<задание>` не даёт получить награду дважды, даже из двух вкладок.
 */
export async function claimQuest(userId: string, claim: QuestClaim, now = Date.now()): Promise<{ reward: number; state: GachaState }> {
  const day = moscowDay(new Date(now));
  const client = await getPool().connect();
  let reward = 0;
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new GachaError('Аккаунт заблокирован.');
    const decision = questReward(await loadQuestBoard(client, userId, day), claim);
    if ('refuse' in decision) throw new GachaError(decision.refuse);
    reward = decision.reward;
    await client.query(`insert into "capLedger"("userId", reason, "sourceKey", amount) values ($1, 'quest', $2, $3)`, [userId, questSourceKey(day, claim), reward]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return { reward, state: await getGachaState(userId, now) };
}

/** Собрать недостающую карточку из осколков: цена — по редкости банки в автомате сейчас. */
export async function craftCard(userId: string, brand: string, flavor: string, pool?: GachaDrink[]): Promise<{ card: GachaDrink; shards: number }> {
  const drink = (pool ?? await gachaPool()).find(item => item.brand === brand && item.flavor === flavor);
  if (!drink) throw new GachaError('Такой банки в автомате нет.');
  const cost = CRAFT_COST[drink.rarity];
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new GachaError('Аккаунт заблокирован.');
    if ((await client.query('select 1 from "gachaCard" where "userId" = $1 and brand = $2 and flavor = $3', [userId, brand, flavor])).rowCount) throw new GachaError('Эта карточка уже в альбоме.');
    if (await shardsOf(client, userId) < cost) throw new GachaError(`Не хватает осколков: нужно ${cost}.`);
    await client.query(`insert into "shardLedger"("userId", reason, "sourceKey", amount) values ($1, 'craft', $2, $3)`, [userId, key(brand, flavor), -cost]);
    await client.query('insert into "gachaCard"("userId", brand, flavor, rarity, crafted) values ($1, $2, $3, $4, true)', [userId, brand, flavor, drink.rarity]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return { card: drink, shards: await shardsOf(getPool(), userId) };
}

export interface AlbumCard extends GachaDrink { count: number; owned: boolean; cost: number }
export interface AlbumBrand { brand: string; owned: number; total: number; cards: AlbumCard[] }
export interface Album { owned: number; total: number; shards: number; byRarity: Record<Rarity, number>; brands: AlbumBrand[] }

/** Альбом: бренды пула, у каждого свои карточки и силуэты недостающих (с ценой крафта); бренды с карточками — первыми. */
export async function getAlbum(userId: string, pool?: GachaDrink[]): Promise<Album> {
  const drinks = pool ?? await gachaPool();
  const [rows, shards] = await Promise.all([
    getPool().query<{ brand: string; flavor: string; rarity: Rarity; count: number }>('select brand, flavor, rarity, count from "gachaCard" where "userId" = $1', [userId]).then(result => result.rows),
    shardsOf(getPool(), userId),
  ]);
  const owned = new Map(rows.map(row => [key(row.brand, row.flavor), row]));
  const brands = new Map<string, AlbumBrand>();
  const byRarity = Object.fromEntries(RARITIES.map(rarity => [rarity, 0])) as Record<Rarity, number>;
  for (const drink of drinks) {
    const card = owned.get(key(drink.brand, drink.flavor));
    const entry = brands.get(drink.brand) ?? { brand: drink.brand, owned: 0, total: 0, cards: [] };
    entry.total += 1;
    if (card) { entry.owned += 1; byRarity[card.rarity] += 1; }
    entry.cards.push({ ...drink, rarity: card?.rarity ?? drink.rarity, count: card?.count ?? 0, owned: Boolean(card), cost: CRAFT_COST[drink.rarity] });
    brands.set(drink.brand, entry);
  }
  const list = [...brands.values()].map(entry => ({ ...entry, cards: entry.cards.sort((a, b) => Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name, 'ru')) }))
    .sort((a, b) => b.owned - a.owned || a.brand.localeCompare(b.brand, 'ru'));
  return { owned: rows.filter(row => drinks.some(drink => drink.brand === row.brand && drink.flavor === row.flavor)).length, total: drinks.length, shards, byRarity, brands: list };
}

/** Лучшие карточки участника — для блока профиля: по редкости, потом по свежести. */
export async function topCards(userId: string, limit = 6, pool?: GachaDrink[]): Promise<(GachaDrink & { count: number })[]> {
  const drinks = new Map((pool ?? await gachaPool()).map(drink => [key(drink.brand, drink.flavor), drink]));
  const rows = (await getPool().query<{ brand: string; flavor: string; rarity: Rarity; count: number }>(`select brand, flavor, rarity, count from "gachaCard" where "userId" = $1
    order by array_position(array['legendary','epic','rare','common'], rarity), "lastAt" desc limit 60`, [userId])).rows;
  return rows.flatMap(row => { const drink = drinks.get(key(row.brand, row.flavor)); return drink ? [{ ...drink, rarity: row.rarity, count: row.count }] : []; }).slice(0, limit);
}

/** The home banner's line for a member: caps, the day's tasks and whether a pull without caps is there. Read-only (no welcome caps). */
export async function getGachaTeaser(userId: string): Promise<{ caps: number; free: boolean; quests: { claimed: number; total: number } }> {
  const pool = getPool();
  const [caps, gifted, board, row] = await Promise.all([balanceOf(pool, userId), giftSpinsOf(pool, userId), loadQuestBoard(pool, userId, moscowDay()), pool.query<{ free: boolean }>(`select ${freeTodaySql} as free`, [userId])]);
  return { caps, free: gifted > 0 || (row.rows[0]?.free ?? true), quests: { claimed: board.claimed, total: board.rows.length } };
}
