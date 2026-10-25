import { getPool } from '@/db/pool';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';

/** XP for 1st–3rd place; the same numbers are in `settle_monthly_top` (migration 0107), change both together. */
export const MONTHLY_TOP_REWARDS = [1000, 600, 300] as const;
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export interface MonthlyTopEntry { place: number; username: string; avatarId: string | null; xp: number; reward: number }
/** A leader of the running month as the ladder row shows them: framed avatar and the chosen tag (still earned). */
export interface MonthlyTopLeader extends MonthlyTopEntry { frame: ProfileAppearance['frame']; tag: string | null }

/** `YYYY-MM` → «октябрь»; the race resolves on the 1st of the next month. */
export function monthlyTopLabels(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return { month: MONTHS[index - 1] ?? '', settles: `1 ${MONTHS_GENITIVE[index % 12] ?? ''}${index === 12 ? ` ${year + 1}` : ''}` };
}

export function monthlyTopReward(place: number): number {
  return MONTHLY_TOP_REWARDS[place - 1] ?? 0;
}

/** Settles the previous month at most once (database function is idempotent and serialized). */
export async function settleMonthlyTop() {
  try { await getPool().query('select settle_monthly_top()'); }
  catch (error) { console.error('Monthly top settlement failed', error); }
}

export async function getMonthlyTop() {
  const db = getPool();
  const [current, previous] = await Promise.all([
    db.query<{ month: string; username: string | null; avatarId: string | null; xp: number | null; appearance: unknown; tag: string | null }>(`
      with period as (select to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM') as month, date_trunc('month', now() at time zone 'Europe/Moscow')::date as start),
      leaders as (
        select u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId", sum(x.points)::int as xp, max(x."createdAt") as reached,
          u."profileAppearance" as appearance,
          case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = u."profileTags"[1]) then u."profileTags"[1] end
            when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag
        from period, "profileExperience" x join "user" u on u.id = x."userId"
        where x.reason <> 'monthly-top' and x."createdAt" <@ monthly_top_bounds(period.start)
          and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
        group by u.id order by xp desc, reached, u.id limit 3)
      select period.month, leaders.* from period left join leaders on true order by leaders.xp desc nulls last, leaders.reached`),
    db.query<{ month: string; place: number; username: string; avatarId: string | null; xp: number; reward: number }>(`
      select to_char(a.month, 'YYYY-MM') as month, a.place, u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId", a.xp, a.reward
      from "monthlyTopAward" a join "user" u on u.id = a."userId"
      where a.month = (select max(month) from "monthlyTopSettlement") and u.username is not null order by a.place`),
  ]);
  const month = current.rows[0]?.month ?? '';
  const leaders: MonthlyTopLeader[] = current.rows.filter(row => row.username && row.xp)
    .map((row, index) => ({ place: index + 1, username: row.username!, avatarId: row.avatarId, xp: row.xp!, reward: monthlyTopReward(index + 1),
      frame: (parseProfileAppearance(row.appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame, tag: row.tag }));
  return { month, leaders, winners: { month: previous.rows[0]?.month ?? null, entries: previous.rows as MonthlyTopEntry[] } };
}
