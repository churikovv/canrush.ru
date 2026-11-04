import type { PoolClient } from 'pg';
import { getPool } from '@/db/pool';
import { isScored, TROPHY_POINTS } from '@/lib/achievement-summary';
import { BADGE_ACHIEVEMENTS } from '@/lib/badges';
import { experienceLevel } from '@/lib/experience-level';
import { PROFILE_ACHIEVEMENTS } from '@/lib/profile-achievements';
import { LEVEL_SPARKS, priceNow, raceSparks, shopItem } from '@/lib/shop-items';

export class ShopError extends Error {}

type Db = Pick<PoolClient, 'query'>;
const POINTS = new Map([...PROFILE_ACHIEVEMENTS, ...BADGE_ACHIEVEMENTS].filter(item => isScored(item.key)).map(item => [item.key, TROPHY_POINTS[item.rarity]]));

/**
 * The trophy score of stored achievements, as the achievements screen counts it: tags (`profileAchievement`) and the
 * achievements that are not tags (`profileBadge`), without role and week tags.
 */
export function trophyScore(keys: Iterable<string>, tiers: Readonly<Record<string, number>> = {}): number {
  let score = 0;
  // Every tier reached adds the rarity's points again (`profileAchievement.tier`).
  for (const key of new Set(keys)) score += (POINTS.get(key) ?? 0) * (tiers[key] ?? 1);
  return score;
}

export interface SparkEarnings { achievements: number; levels: number; race: number }
/** Sparks from each source (`shop-items.ts`): achievements by rarity, every level above the first, week race places. */
export function sparkEarnings(keys: Iterable<string>, xp: number, places: readonly number[], tiers: Readonly<Record<string, number>> = {}): SparkEarnings {
  return { achievements: trophyScore(keys, tiers), levels: (experienceLevel(xp).level - 1) * LEVEL_SPARKS, race: places.reduce((sum, place) => sum + raceSparks(place), 0) };
}

export interface ShopState { earned: number; sources: SparkEarnings; spent: number; balance: number; owned: string[] }

async function readShop(db: Db, userId: string): Promise<ShopState> {
  const { rows } = await db.query<{ keys: string[]; tiers: Record<string, number> | null; owned: string[] | null; spent: number; xp: number; places: number[] }>(`select
      (select json_object_agg(key, tier) from "profileAchievement" where "userId" = $1) as tiers,
      array(select key from "profileAchievement" where "userId" = $1 union select key from "profileBadge" where "userId" = $1) as keys,
      array(select key from "shopPurchase" where "userId" = $1 order by "createdAt") as owned,
      coalesce((select sum(price) from "shopPurchase" where "userId" = $1), 0)::int as spent,
      coalesce((select sum(points) from "profileExperience" where "userId" = $1), 0)::int as xp,
      array(select place::int from "weeklyTopAward" where "userId" = $1) as places`, [userId]);
  const row = rows[0]!;
  const sources = sparkEarnings(row.keys, row.xp, row.places, row.tiers ?? {});
  const earned = sources.achievements + sources.levels + sources.race;
  // A removed achievement could leave the earnings under what was spent; the balance never goes negative.
  return { earned, sources, spent: row.spent, balance: Math.max(0, earned - row.spent), owned: row.owned ?? [] };
}

export const getShop = (userId: string) => readShop(getPool(), userId);

/** Spends sparks on a shop item once, at today's price; checks the balance under the member's lock. */
export async function buyShopItem(userId: string, key: string, now = new Date()): Promise<ShopState> {
  const item = shopItem(key);
  if (!item) throw new ShopError('Такого товара нет в магазине.');
  const price = priceNow(item, now);
  const client = await getPool().connect();
  try {
    await client.query('begin');
    if (!(await client.query('select 1 from "user" where id = $1 for update', [userId])).rowCount) throw new ShopError('Профиль не найден.');
    if ((await client.query('select 1 from "userBlock" where "userId" = $1', [userId])).rowCount) throw new ShopError('Аккаунт заблокирован.');
    const before = await readShop(client, userId);
    if (before.owned.includes(key)) throw new ShopError('Уже куплено.');
    if (before.balance < price) throw new ShopError(`Не хватает ${price - before.balance} искр.`);
    await client.query('insert into "shopPurchase" ("userId", key, price) values ($1, $2, $3)', [userId, key, price]);
    const after = await readShop(client, userId);
    await client.query('commit');
    return after;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}
