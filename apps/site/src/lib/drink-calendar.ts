import { getPool } from '@/db/pool';
import { getBrandCollections } from '@/lib/brand-collection';
import { catalogGroupSlug } from '@/lib/catalog-query';
import { getProfileCommunity } from '@/lib/profile-community';
import { ROLE_TAGS } from '@/lib/profile-achievements';
import { storeDrinkOptions } from '@/lib/store-catalog';
import {
  DRINKS_PER_DAY, DRINK_DAY_XP, DRINK_EDIT_WINDOW_DAYS, DrinkCalendarError, addDays, bestStreak, currentStreak, drinkStreaks,
  moscowDay, reachedMilestones, streakOn, streakReward, streakRestore, type DrinkInput, type DrinkStreak, type StreakRestore,
} from '@/lib/drink-calendar-fields';

export interface DrinkEntry { id: string; day: string; name: string; brand: string | null; flavor: string | null; price: number | null; store: string | null; href?: string; cover?: string }
export interface DrinkOverview {
  today: string; dayCounts: Record<string, number>; streaks: DrinkStreak[]; current: DrinkStreak | null; best: number; total: number;
  /** Days brought back with «Вернуть огонёк»: streak days without a can. */
  restored: string[];
  /** What «Вернуть огонёк» offers now (only meaningful to the owner). */
  restore: StreakRestore;
}

const catalogKey = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);

/**
 * Day counts for all time; streaks are short lists of runs, so they are derived in memory. Restored days count for
 * streaks but not as cans.
 */
export async function getDrinkOverview(userId: string, today = moscowDay()): Promise<DrinkOverview> {
  const [{ rows }, restores] = await Promise.all([
    getPool().query<{ day: string; count: number }>('select day::text as day, count(*)::int as count from "drinkLog" where "userId" = $1 group by day order by day', [userId]),
    getPool().query<{ day: string; created: string }>(`select day::text as day, ("createdAt" at time zone 'Europe/Moscow')::date::text as created
      from "drinkStreakRestore" where "userId" = $1 order by "createdAt"`, [userId]),
  ]);
  const dayCounts = Object.fromEntries(rows.map(row => [row.day, row.count]));
  const restored = restores.rows.map(row => row.day);
  const streakDays = [...rows.map(row => row.day), ...restored];
  const streaks = drinkStreaks(streakDays);
  return {
    today, dayCounts, streaks, current: currentStreak(streaks, today), best: bestStreak(streaks), total: rows.reduce((sum, row) => sum + row.count, 0),
    restored, restore: streakRestore(streakDays, today, restores.rows.at(-1)?.created ?? null),
  };
}

/** Streak days inside a transaction: cans and restored days (the `drinkStreakDay` view). */
async function streakDays(client: { query: ReturnType<typeof getPool>['query'] }, userId: string): Promise<string[]> {
  return (await client.query<{ day: string }>('select distinct day::text as day from "drinkStreakDay" where "userId" = $1 order by day', [userId])).rows.map(row => row.day);
}

/** Pays the milestones the streak around `day` has reached; keys by its first day, so nothing pays twice. */
async function payStreak(client: { query: ReturnType<typeof getPool>['query'] }, userId: string, awards: [string, string, number][]): Promise<number> {
  const paid = await client.query<{ points: number }>(`insert into "profileExperience" ("userId", reason, "sourceKey", points)
    select $1, a.reason, a.key, a.points from unnest($2::text[], $3::text[], $4::int[]) as a(reason, key, points)
    where not exists(select 1 from "userBlock" where "userId" = $1) on conflict do nothing returning points`,
  [userId, awards.map(item => item[0]), awards.map(item => item[1]), awards.map(item => item[2])]);
  return paid.rows.reduce((sum, row) => sum + row.points, 0);
}

/**
 * «Вернуть огонёк»: fills the one missed day `streakRestore` offers, at most once per cooldown, checked again under a
 * lock on the member. The joined streak pays its milestones as a logged can would (keyed by its first day, so the
 * part already paid stays paid); the restored day itself pays nothing.
 */
export async function restoreStreak(userId: string, today = moscowDay()): Promise<{ length: number; xp: number; day: string }> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    const last = (await client.query<{ created: string }>(`select ("createdAt" at time zone 'Europe/Moscow')::date::text as created
      from "drinkStreakRestore" where "userId" = $1 order by "createdAt" desc limit 1`, [userId])).rows[0]?.created ?? null;
    const offer = streakRestore(await streakDays(client, userId), today, last);
    if (!offer) throw new DrinkCalendarError('Сейчас вернуть нечего: огонёк возвращается за один пропущенный день в последние три дня.');
    if ('availableOn' in offer) throw new DrinkCalendarError('Огонёк можно вернуть раз в 15 дней.');
    await client.query('insert into "drinkStreakRestore" ("userId", day) values ($1, $2::date)', [userId, offer.day]);
    const streak = streakOn(drinkStreaks(await streakDays(client, userId)), offer.day)!;
    const xp = await payStreak(client, userId, reachedMilestones(streak).map(goal => ['drink-streak', `${streak.start}:${goal}`, streakReward(goal)]));
    await client.query('commit');
    // A joined streak can reach the 7 / 14 / 30 tags: grant them now, as a logged can does.
    await getProfileCommunity(userId).catch(() => null);
    return { length: streak.length, xp, day: offer.day };
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

/** Cans in [from, to]. Price and store are the owner's private notes and stay out of other viewers' pages. */
export async function getDrinkEntries(userId: string, from: string, to: string, includePrivate: boolean, withCatalog = false): Promise<DrinkEntry[]> {
  const { rows } = await getPool().query<DrinkEntry>(`select id::text, day::text as day, name, brand, flavor,
      case when $4::boolean then price end as price, case when $4::boolean then store end as store
    from "drinkLog" where "userId" = $1 and day between $2::date and $3::date order by day, "createdAt", id`, [userId, from, to, includePrivate]);
  if (!withCatalog || !rows.some(row => row.brand)) return rows;
  const options = new Map((await storeDrinkOptions()).map(option => [catalogKey(option.brand, option.flavor), option]));
  return rows.map(row => {
    if (!row.brand || !row.flavor) return row;
    const option = options.get(catalogKey(row.brand, row.flavor));
    return { ...row, href: `/catalog/${catalogGroupSlug(row.brand, row.flavor)}`, ...(option?.cover ? { cover: option.cover } : {}) };
  });
}

/** The owner's recent stores, offered as suggestions in the form. */
export async function getRecentDrinkStores(userId: string): Promise<string[]> {
  const { rows } = await getPool().query<{ store: string }>(`select store from "drinkLog" where "userId" = $1 and store is not null
    group by store order by max("createdAt") desc limit 12`, [userId]);
  return rows.map(row => row.store);
}

/**
 * Logs one can. Catalog links are checked on the server: an unknown pair becomes the member's own drink.
 * XP: a fixed amount per logged day and a bonus per streak milestone; both are ledger rows keyed so that
 * removing and re-adding a can never pays twice.
 */
export async function addDrink(userId: string, input: DrinkInput, today = moscowDay()) {
  let { name, brand, flavor } = input;
  if (brand !== undefined && flavor !== undefined) {
    const option = (await storeDrinkOptions()).find(item => item.brand === brand && item.flavor === flavor);
    if (option) name = option.label; else { brand = undefined; flavor = undefined; }
  }
  const client = await getPool().connect();
  let streak: DrinkStreak | undefined;
  let xp = 0;
  const before = new Set((await getPool().query<{ key: string }>('select key from "profileAchievement" where "userId" = $1', [userId])).rows.map(row => row.key));
  try {
    await client.query('begin');
    await client.query('select 1 from "user" where id = $1 for no key update', [userId]);
    const count = await client.query<{ count: number }>('select count(*)::int as count from "drinkLog" where "userId" = $1 and day = $2::date', [userId, input.day]);
    if ((count.rows[0]?.count ?? 0) >= DRINKS_PER_DAY) throw new DrinkCalendarError(`За один день можно отметить не больше ${DRINKS_PER_DAY} банок.`);
    await client.query('insert into "drinkLog" ("userId", day, name, brand, flavor, price, store) values ($1, $2::date, $3, $4, $5, $6, $7)',
      [userId, input.day, name, brand ?? null, flavor ?? null, input.price, input.store]);
    streak = streakOn(drinkStreaks(await streakDays(client, userId)), input.day);
    const awards: [string, string, number][] = [['drink-day', input.day, DRINK_DAY_XP]];
    if (streak) for (const goal of reachedMilestones(streak)) awards.push(['drink-streak', `${streak.start}:${goal}`, streakReward(goal)]);
    xp = await payStreak(client, userId, awards);
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
  // Grants the calendar tags (and their XP) right away instead of on the next profile view.
  const tags = (await getProfileCommunity(userId)).earned.filter(key => !before.has(key) && !ROLE_TAGS.has(key));
  if (tags.length) xp += (await getPool().query<{ points: number }>(`select coalesce(sum(points), 0)::int as points from "profileExperience"
    where "userId" = $1 and reason = 'achievement' and "sourceKey" = any($2::text[])`, [userId, tags])).rows[0]?.points ?? 0;
  // A new catalog drink can complete a share of its brand collection.
  if (brand !== undefined) xp += (await getBrandCollections(userId)).xp;
  return { streak: currentStreak(streak ? [streak] : [], today)?.length ?? 0, xp, tags };
}

/** Only recent cans can be removed, so a streak's first day (which keys its bonuses) cannot be shifted to re-earn them. */
export async function deleteDrink(userId: string, id: string, today = moscowDay()) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DrinkCalendarError('Запись не найдена.');
  const result = await getPool().query('delete from "drinkLog" where id = $1 and "userId" = $2 and day >= $3::date',
    [id, userId, addDays(today, -DRINK_EDIT_WINDOW_DAYS)]);
  if (!result.rowCount) throw new DrinkCalendarError('Удалить можно только свои записи за сегодня и вчера.');
}
