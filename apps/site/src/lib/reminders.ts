import type { Pool } from 'pg';
import { addDays, currentStreak, drinkStreaks } from '@/lib/drink-calendar-fields';

/** A shorter streak is not worth an evening message. */
export const STREAK_REMINDER_MIN_DAYS = 3;
/** Days after the last pull (or the first visit) that the free pull is still mentioned: then the member has stopped answering. */
export const GACHA_REMINDER_DAYS = 7;

/** One key per Moscow day: the notification's unique key keeps a member to one reminder of either type a day. */
const reminderKey = (day: string) => `reminder:${day}`;

/** Banned and frozen members get no reminders. */
const REACHABLE = `not exists(select 1 from "userBlock" b where b."userId" = u.id)
  and not exists(select 1 from "userFreeze" f where f."userId" = u.id and f.until > now())`;

/**
 * Streaks that go out tomorrow: the last marked day is yesterday and today has no mark yet. Runs are derived in memory,
 * as in the calendar, and read the `drinkStreakDay` view, so restored days count.
 */
async function streaksAtRisk(pool: Pool, day: string): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ userId: string; days: string[] }>(`
    select "userId", array_agg(day::text) as days from "drinkStreakDay"
    where "userId" in (
      select "userId" from "drinkStreakDay" where day = $1::date
      except select "userId" from "drinkStreakDay" where day = $2::date)
    group by "userId"`, [addDays(day, -1), day]);
  const atRisk = new Map<string, number>();
  for (const row of rows) {
    const length = currentStreak(drinkStreaks(row.days), day)?.length ?? 0;
    if (length >= STREAK_REMINDER_MIN_DAYS) atRisk.set(row.userId, length);
  }
  return atRisk;
}

/** A reminder means something only on its day: the next run removes it, so the bell of a member who is away stays clean. */
async function dropStaleReminders(pool: Pool, day: string): Promise<void> {
  await pool.query(`delete from notification where kind = 'reminder' and "eventKey" <> $1`, [reminderKey(day)]);
}

/** Evening: the streak goes out tomorrow unless today's can gets marked. Only about marking, never a nudge to drink. */
export async function queueStreakReminders(pool: Pool, day: string): Promise<void> {
  await dropStaleReminders(pool, day);
  const atRisk = await streaksAtRisk(pool, day);
  await pool.query(`
    insert into notification ("userId", kind, "eventKey", payload)
    select u.id, 'reminder', $1, jsonb_build_object('type', 'streak', 'length', risk.length)
    from unnest($2::text[], $3::int[]) as risk(id, length) join "user" u on u.id = risk.id
    where ${REACHABLE}
    on conflict ("userId", "eventKey") do nothing`, [reminderKey(day), [...atRisk.keys()], [...atRisk.values()]]);
}

/**
 * Daytime: the member has opened the machine (its first visit pays `welcome`) and today's free pull is still there.
 * A streak at risk wins: that member hears about it in the evening instead. Silence after `GACHA_REMINDER_DAYS` without
 * a pull, counted from the machine and not from site visits: a daily reader of the feed who ignores it has not answered
 * either. The next pull starts the count again. The streak needs no such stop: an ignored one goes out by itself.
 */
export async function queueGachaReminders(pool: Pool, day: string): Promise<void> {
  await dropStaleReminders(pool, day);
  const atRisk = await streaksAtRisk(pool, day);
  await pool.query(`
    insert into notification ("userId", kind, "eventKey", payload)
    select u.id, 'reminder', $1, '{"type":"gacha"}'::jsonb
    from "user" u join "capLedger" c on c."userId" = u.id and c.reason = 'welcome'
    where greatest(c."createdAt", (select max(p."createdAt") from "gachaPull" p where p."userId" = u.id))
        >= ($2::date - $4::int)::timestamp at time zone 'Europe/Moscow'
      and not exists(select 1 from "gachaPull" p where p."userId" = u.id and p."freeDay" = $2::date)
      and u.id <> all($3::text[])
      and ${REACHABLE}
    on conflict ("userId", "eventKey") do nothing`, [reminderKey(day), day, [...atRisk.keys()], GACHA_REMINDER_DAYS]);
}
