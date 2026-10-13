import { getPool } from '@/db/pool';

export const MONTHLY_TOP_REWARDS = [500, 300, 150] as const;
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export interface MonthlyTopEntry { place: number; username: string; avatarId: string | null; xp: number; reward: number }

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
    db.query<{ month: string; username: string | null; avatarId: string | null; xp: number | null }>(`
      with period as (select to_char(now() at time zone 'Europe/Moscow', 'YYYY-MM') as month, date_trunc('month', now() at time zone 'Europe/Moscow')::date as start),
      leaders as (
        select u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId", sum(x.points)::int as xp, max(x."createdAt") as reached
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
  const leaders: MonthlyTopEntry[] = current.rows.filter(row => row.username && row.xp)
    .map((row, index) => ({ place: index + 1, username: row.username!, avatarId: row.avatarId, xp: row.xp!, reward: monthlyTopReward(index + 1) }));
  return { month, leaders, winners: { month: previous.rows[0]?.month ?? null, entries: previous.rows as MonthlyTopEntry[] } };
}
