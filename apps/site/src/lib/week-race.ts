import { getPool } from '@/db/pool';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
import { TOP_PLACES, weekEndsAt, weekPrize } from '@/lib/season-fields';

export interface RaceEntry { place: number; username: string; avatarId: string | null; xp: number; reward: number; frame: ProfileAppearance['frame']; tag: string | null; verified: boolean }
/** Место зрителя в гонке; `gap` — сколько опыта не хватает до десятки (0, если он в ней). */
export interface RaceViewer { place: number; xp: number; gap: number }
/** Как зритель выглядит в строке рейтинга: для примерки наград, даже если опыта за неделю у него ещё нет. */
export interface RaceMe { username: string | null; avatarId: string | null; frame: ProfileAppearance['frame'] }
export interface WeekRace { leaders: RaceEntry[]; viewer: RaceViewer | null; winners: string[]; me: RaceMe | null; now: number; endsAt: number }

/** Подводит прошедшую неделю не больше одного раза: функция в базе идемпотентна и идёт по очереди. */
export async function settleWeek() {
  try { await getPool().query('select settle_weekly_top()'); }
  catch (error) { console.error('Week settlement failed', error); }
}

/** Десятка недели и место зрителя. Считает так же, как `settle_weekly_top`: без наградного опыта, только с ником и без бана. */
export async function getWeekRace(viewerId: string | null = null, now = Date.now()): Promise<WeekRace> {
  const db = getPool();
  const [rows, winners, me] = await Promise.all([
    db.query<{ id: string; place: number; username: string; avatarId: string | null; xp: number; appearance: unknown; tag: string | null; verified: boolean }>(`
      with totals as (
        select u.id, u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId", sum(x.points)::int as xp, max(x."createdAt") as reached,
          u."profileAppearance" as appearance,
          case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" where email = lower(u.email) and role = u."profileTags"[1]) then u."profileTags"[1] end
            when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag, u."verifiedAt" is not null as verified
        from "profileExperience" x join "user" u on u.id = x."userId"
        where x.reason not in ('monthly-top', 'weekly-top') and x."createdAt" <@ weekly_top_bounds(date_trunc('week', now() at time zone 'Europe/Moscow')::date)
          and u.username is not null and not exists(select 1 from "userBlock" b where b."userId" = u.id)
        group by u.id),
      ranked as (select *, row_number() over (order by xp desc, reached, id)::int as place from totals)
      select id, place, username, "avatarId", xp, appearance, tag, verified from ranked where place <= $1 or id = $2 order by place`, [TOP_PLACES, viewerId]),
    db.query<{ username: string }>(`select u.username from "weeklyTopAward" a join "user" u on u.id = a."userId"
      where a.week = (select max(week) from "weeklyTopSettlement") and u.username is not null order by a.place limit 3`),
    viewerId ? db.query<{ username: string | null; avatarId: string | null; appearance: unknown }>(`select u.username, (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId", u."profileAppearance" as appearance
      from "user" u where u.id = $1`, [viewerId]) : null,
  ]);
  const top = rows.rows.filter(row => row.place <= TOP_PLACES);
  const own = rows.rows.find(row => row.id === viewerId);
  return {
    leaders: top.map(row => ({ place: row.place, username: row.username, avatarId: row.avatarId, xp: row.xp, reward: weekPrize(row.place)?.xp ?? 0,
      frame: (parseProfileAppearance(row.appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame, tag: row.tag, verified: row.verified })),
    viewer: own ? { place: own.place, xp: own.xp, gap: own.place <= TOP_PLACES ? 0 : (top.at(-1)?.xp ?? 0) - own.xp + 1 } : null,
    winners: winners.rows.map(row => row.username),
    now, endsAt: weekEndsAt(now),
    me: me?.rows[0] ? { username: me.rows[0].username, avatarId: me.rows[0].avatarId, frame: (parseProfileAppearance(me.rows[0].appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame } : null,
  };
}
