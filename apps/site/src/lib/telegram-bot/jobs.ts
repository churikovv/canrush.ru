import { DEFAULT_CITY, findCity, type CityId } from '@canrush/shared';
import type { Pool } from 'pg';
import { pruneErrorGroups } from '@/lib/error-log';
import { queueGachaReminders, queueStreakReminders } from '@/lib/reminders';
import { bestPromos, cityPromos, promoKey, type BotPromo } from './catalog';
import type { AdminSummary } from './format';
import { enqueueTelegram, pruneOutbox, telegramAdminIds, type AdminSummaryPayload, type PromoPayload } from './outbox';

export const PROMO_ALERT_LIMIT = 10;
export const DIGEST_LIMIT = 8;

export interface MoscowClock { date: string; hour: number; weekday: number }

export function moscowClock(now = new Date()): MoscowClock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday ?? '') + 1;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday };
}

interface ScheduledJob {
  name: string;
  /** Period key when the job is due at this time, otherwise null. */
  due(clock: MoscowClock): string | null;
  run(pool: Pool, period: string): Promise<void>;
}

/** Times are Moscow time: the parser finishes around 06:00. */
export const TELEGRAM_JOBS: readonly ScheduledJob[] = [
  { name: 'prune', due: clock => (clock.hour >= 4 ? clock.date : null), run: async pool => { await pruneOutbox(pool); await pruneErrorGroups(pool); } },
  { name: 'admin-summary', due: clock => (clock.hour >= 9 ? clock.date : null), run: queueAdminSummary },
  { name: 'promo-alerts', due: clock => (clock.hour >= 10 ? clock.date : null), run: queuePromoAlerts },
  { name: 'weekly-digest', due: clock => (clock.weekday === 1 && clock.hour >= 11 ? clock.date : null), run: queueWeeklyDigest },
  // Reminders have a closing hour: a run missed by a restart is skipped rather than sent at night.
  { name: 'gacha-reminder', due: clock => (clock.hour >= 13 && clock.hour < 16 ? clock.date : null), run: queueGachaReminders },
  { name: 'streak-reminder', due: clock => (clock.hour >= 18 && clock.hour < 20 ? clock.date : null), run: queueStreakReminders },
];

/** Claims each due period once across all instances; a failed run releases its claim to retry later. */
export async function runDueJobs(pool: Pool, now = new Date()): Promise<void> {
  const clock = moscowClock(now);
  for (const job of TELEGRAM_JOBS) {
    const period = job.due(clock);
    if (!period) continue;
    const claimed = await pool.query('insert into "telegramJobRun" (job, period) values ($1, $2) on conflict do nothing', [job.name, period]);
    if (!claimed.rowCount) continue;
    try {
      await job.run(pool, period);
    } catch (error) {
      await pool.query('delete from "telegramJobRun" where job = $1 and period = $2', [job.name, period]);
      console.error(`Telegram job ${job.name} failed`, error instanceof Error ? error.message : error);
    }
  }
}

function cityOf(value: string | null): { id: CityId; name: string } {
  const city = findCity(value) ?? DEFAULT_CITY;
  return { id: city.id, name: city.name };
}

function promoCache() {
  const cache = new Map<CityId, Promise<BotPromo[]>>();
  return (id: CityId) => {
    let promos = cache.get(id);
    if (!promos) cache.set(id, (promos = cityPromos(id)));
    return promos;
  };
}

/** Favourite drinks that went on promotion since the last alert; each promo is announced once. */
export async function queuePromoAlerts(pool: Pool, period: string): Promise<void> {
  const promosFor = promoCache();
  const { rows } = await pool.query<{ userId: string; city: string | null }>(`
    select a."userId", c.city from "telegramChat" c
    join account a on a."providerId" = 'telegram' and a."accountId" = c."telegramId"::text
    where c."blockedAt" is null and c."promoAlerts"
      and exists (select 1 from favorite f where f."userId" = a."userId")`);
  for (const row of rows) {
    const city = cityOf(row.city);
    const favorites = await pool.query<{ brand: string; flavor: string }>('select brand, flavor from favorite where "userId" = $1', [row.userId]);
    const wanted = new Set(favorites.rows.map(f => JSON.stringify([f.brand, f.flavor])));
    const candidates = (await promosFor(city.id)).filter(promo => wanted.has(JSON.stringify([promo.brand, promo.flavor])));
    if (!candidates.length) continue;

    const client = await pool.connect();
    try {
      await client.query('begin');
      const fresh: BotPromo[] = [];
      for (const promo of candidates) {
        const seen = await client.query('insert into "telegramPromoSeen" ("userId", key) values ($1, $2) on conflict do nothing', [row.userId, `${city.id}:${promoKey(promo)}`]);
        if (seen.rowCount) fresh.push(promo);
      }
      if (fresh.length) {
        const payload: PromoPayload = { cityName: city.name, promos: fresh.sort((a, b) => a.price - b.price).slice(0, PROMO_ALERT_LIMIT) };
        await enqueueTelegram(client, row.userId, 'promo', payload, `promo:${period}:${row.userId}`);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Monday digest for every started chat, linked to an account or not. */
export async function queueWeeklyDigest(pool: Pool, period: string): Promise<void> {
  const promosFor = promoCache();
  const { rows } = await pool.query<{ city: string | null }>(`select distinct city from "telegramChat" where "blockedAt" is null and "weeklyDigest"`);
  const cities = new Map(rows.map(row => cityOf(row.city)).map(city => [city.id, city]));
  for (const city of cities.values()) {
    const promos = bestPromos(await promosFor(city.id), DIGEST_LIMIT);
    if (!promos.length) continue;
    const payload: PromoPayload = { cityName: city.name, promos };
    await pool.query(`
      insert into "telegramOutbox" ("chatId", kind, payload, "dedupeKey")
      select "chatId", 'digest', $1::jsonb, 'digest:' || $2 || ':' || "chatId" from "telegramChat"
      where "blockedAt" is null and "weeklyDigest" and coalesce(city, $3) = $4
      on conflict ("dedupeKey") do nothing`, [JSON.stringify(payload), period, DEFAULT_CITY.id, city.id]);
  }
}

export async function collectAdminSummary(pool: Pool, now = new Date()): Promise<AdminSummary> {
  const { rows } = await pool.query<Record<keyof AdminSummary, number>>(`
    with since as (select $1::timestamptz - interval '24 hours' as at)
    select
      (select count(*) from "user", since where "createdAt" > since.at)::int as "newUsers",
      (select count(*) from "user")::int as "totalUsers",
      (select count(*) from review, since where review."createdAt" > since.at)::int as reviews,
      ((select count(*) from "reviewComment" c, since where c."createdAt" > since.at)
        + (select count(*) from "tierListComment" c, since where c."createdAt" > since.at)
        + (select count(*) from "wallReply" c, since where c."createdAt" > since.at))::int as comments,
      (select count(*) from "profileComment" p, since where p."createdAt" > since.at)::int as "wallPosts",
      (select count(*) from "tierList" t, since where t."createdAt" > since.at)::int as "tierLists",
      (select count(*) from "marketOrder" o, since where o."createdAt" > since.at)::int as "marketOrders",
      coalesce((select max(n) from (select count(*) as n from "presenceSample", since where bucket > since.at group by bucket) b), 0)::int as "peakOnline"`, [now]);
  const row = rows[0];
  if (!row) throw new Error('Admin summary query returned no row');
  return row;
}

export async function queueAdminSummary(pool: Pool, period: string): Promise<void> {
  const admins = await telegramAdminIds(pool);
  if (!admins.length) return;
  const payload: AdminSummaryPayload = { day: period, summary: await collectAdminSummary(pool) };
  for (const admin of admins) await enqueueTelegram(pool, admin, 'admin-summary', payload, `admin-summary:${period}:${admin}`);
}
