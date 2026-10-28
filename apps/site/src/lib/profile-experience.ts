import { getPool } from '@/db/pool';
import type { Experience } from '@/lib/experience-level';
import { currentStreak, drinkStreaks, moscowDay } from '@/lib/drink-calendar-fields';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
export async function getExperience(usernames: string[]) {
  const rows = await getPool().query<Experience & { username: string }>(`with population as (select username,xp,rank,rank() over(order by xp) as ascending_rank,count(*) over() as total from "profileRanking") select username,xp,rank,coalesce(floor(100.0*(ascending_rank-1)/nullif(total-1,0))::int,0) as "aheadPercent" from population where username=any($1::text[])`, [usernames]);
  return Object.fromEntries(rows.rows.map(row => [row.username, { xp: row.xp, aheadPercent: row.aheadPercent, rank: row.xp ? row.rank : null }]));
}
export interface LeaderboardRow {
  username: string; name: string; xp: number; rank: number; avatarId: string | null;
  frame: ProfileAppearance['frame'];
  /** The chosen tag, only while still earned (role tags only while the role holds), as in people search. */
  tag: string | null; engineNumber: number | null;
  /** Current calendar streak in days (alive while the last can is today or yesterday, Moscow), 0 without one. */
  streak: number;
  reviews: number; cans: number; tierLists: number;
}

/**
 * Top 100 by all-time XP with what a row shows: framed avatar, tag, streak and three counters. The ranking view runs
 * once (it ranks everyone); the per-row counters use indexed lookups, and streaks are counted here from the last
 * year's distinct days.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { rows } = await getPool().query<Omit<LeaderboardRow, 'frame' | 'streak'> & { appearance: unknown; days: string[] }>(`
    with top as (select * from "profileRanking" where xp > 0 order by xp desc, username limit 100)
    select r.username, r.name, r.xp, r.rank,
      (select id::text from "profileImage" where "userId" = r.id and kind = 'avatar') as "avatarId",
      u."profileAppearance" as appearance,
      case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = u."profileTags"[1]) then u."profileTags"[1] end
        when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag,
      (select number from "betaEngine" where "userId" = u.id) as "engineNumber",
      (select count(*)::int from review where "userId" = u.id) as reviews,
      (select count(*)::int from "drinkLog" where "userId" = u.id) as cans,
      (select count(*)::int from "tierList" where "userId" = u.id and status = 'published') as "tierLists",
      array(select distinct day::text from "drinkStreakDay" where "userId" = u.id and day > (now() at time zone 'Europe/Moscow')::date - 400) as days
    from top r join "user" u on u.id = r.id
    order by r.xp desc, r.username`);
  const today = moscowDay();
  return rows.map(({ appearance, days, ...row }) => ({
    ...row,
    frame: (parseProfileAppearance(appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame,
    streak: currentStreak(drinkStreaks(days), today)?.length ?? 0,
  }));
}
