import { getPool } from '@/db/pool';
import { FIRST_SWIPES } from '@/lib/first-steps';
import {
  DAILY_MILESTONES, RETENTION_WEEKS, RETENTION_WINDOWS, USAGE_DAYS, USAGE_FEATURES,
  type CohortCell, type RetentionWindowKey, type UsageFeatureKey,
} from '@/lib/admin-growth-fields';

/** One week of sign-ups (Monday, Moscow) and how many came back in each window. */
export interface RetentionCohort { week: string; members: number; cells: Record<RetentionWindowKey, CohortCell> }
export interface AdminRetention {
  /** Newest week first; weeks before activity was recorded are left out. */
  cohorts: RetentionCohort[];
  /** The first day of `activityDay`: nothing before it can be told apart from «did not come back». */
  since: string | null;
  /** Average members a day over the last 30 complete days, the distinct members over them, and the days counted. */
  stickiness: { daily: number; monthly: number; days: number };
  /** Members active 31–60 days ago, and how many of them were active again in the last 30 complete days. */
  monthBack: { previous: number; returned: number };
  /** Newcomers of the last 30 days whose next day is over: came back on it. */
  nextDay: CohortCell;
}

export interface AdminUsage {
  features: { key: UsageFeatureKey; byDay: { day: string; members: number }[]; week: number; month: number }[];
  /** Members with signed-in activity in the last 7 days, today included: what a feature's weekly reach is shared of. */
  activeWeek: number;
  /** «Лунный цикл»: runs alive now (claimed today or yesterday), how far they got, and who finished a cycle ever. */
  daily: { alive: number; today: number; reached: Record<number, number>; finished: number; ever: number };
  /** «Первые шаги» among members who signed up in the last 30 days, at any time since, not only on day one. */
  firstSteps: { members: number; pulled: number; swiped: number; followed: number; all: number; tag: number; frame: number };
}

const TODAY = `(now() at time zone 'Europe/Moscow')::date`;
const LIVE = (column: string) => `not exists(select 1 from "userBlock" b where b."userId" = ${column})`;

/**
 * Weekly sign-up cohorts and how they come back (`RETENTION_WINDOWS`), the share of the month's members seen on an
 * average day, and how many of last month's members are still here. Blocked members are left out everywhere.
 */
export async function getRetentionMetrics(): Promise<AdminRetention> {
  const db = getPool();
  const windows = RETENTION_WINDOWS.map(window => `
      (count(*) filter (where m.joined + ${window.to} < b.today))::int as "${window.key}_eligible",
      (count(*) filter (where m.joined + ${window.to} < b.today and exists(select 1 from "activityDay" a
        where a."userId" = m.id and a.day between m.joined + ${window.from} and m.joined + ${window.to})))::int as "${window.key}_returned"`).join(',');
  const [cohorts, totals] = await Promise.all([
    db.query<Record<string, string | number>>(`with b as (
        select ${TODAY} as today, (select min(day) from "activityDay") as since
      ), m as (
        select u.id, (u."createdAt" at time zone 'Europe/Moscow')::date as joined from "user" u, b
        where b.since is not null and ${LIVE('u.id')}
          and (u."createdAt" at time zone 'Europe/Moscow')::date >= greatest(b.since, date_trunc('week', b.today)::date - ${(RETENTION_WEEKS - 1) * 7})
      )
      select to_char(date_trunc('week', m.joined)::date, 'YYYY-MM-DD') as week, count(*)::int as members,${windows}
      from m, b group by 1 order by 1 desc`),
    db.query<{ since: string | null; daily: number; monthly: number; days: number; previous: number; returned: number; eligible: number; came: number }>(`with b as (
        select ${TODAY} as today
      ), recent as (
        select a."userId", a.day from "activityDay" a, b where a.day between b.today - 30 and b.today - 1 and ${LIVE('a."userId"')}
      ), earlier as (
        select distinct a."userId" from "activityDay" a, b where a.day between b.today - 60 and b.today - 31 and ${LIVE('a."userId"')}
      ), newcomers as (
        select u.id, (u."createdAt" at time zone 'Europe/Moscow')::date as joined from "user" u, b
        where (u."createdAt" at time zone 'Europe/Moscow')::date between b.today - 30 and b.today - 2
          and (u."createdAt" at time zone 'Europe/Moscow')::date >= (select min(day) from "activityDay") and ${LIVE('u.id')}
      )
      select (select to_char(min(day), 'YYYY-MM-DD') from "activityDay") as since,
        coalesce((select count(*)::float8 / nullif(count(distinct day), 0) from recent), 0) as daily,
        (select count(distinct "userId")::int from recent) as monthly,
        (select count(distinct day)::int from recent) as days,
        (select count(*)::int from earlier) as previous,
        (select count(*)::int from earlier e where exists(select 1 from recent r where r."userId" = e."userId")) as returned,
        (select count(*)::int from newcomers) as eligible,
        (select count(*)::int from newcomers n where exists(select 1 from "activityDay" a where a."userId" = n.id and a.day = n.joined + 1)) as came`),
  ]);
  const row = totals.rows[0];
  return {
    cohorts: cohorts.rows.map(cohort => ({
      week: String(cohort.week), members: Number(cohort.members),
      cells: Object.fromEntries(RETENTION_WINDOWS.map(window => [window.key, {
        returned: Number(cohort[`${window.key}_returned`] ?? 0), eligible: Number(cohort[`${window.key}_eligible`] ?? 0),
      }])) as Record<RetentionWindowKey, CohortCell>,
    })),
    since: row?.since ?? null,
    stickiness: { daily: Number(row?.daily ?? 0), monthly: row?.monthly ?? 0, days: row?.days ?? 0 },
    monthBack: { previous: row?.previous ?? 0, returned: row?.returned ?? 0 },
    nextDay: { returned: row?.came ?? 0, eligible: row?.eligible ?? 0 },
  };
}

/** Where each feature's members come from: one row per action with the member and its time. */
const FEATURE_EVENTS: Record<UsageFeatureKey, string> = {
  gacha: `select "userId", "createdAt" as at from "gachaPull"`,
  battle: `select "userId", "createdAt" as at from battle
    union all select "hostId", "createdAt" from "battleDuel"
    union all select "guestId", "startedAt" from "battleDuel" where "guestId" is not null and "startedAt" is not null`,
  daily: `select "userId", "createdAt" as at from "dailyReward"`,
  chat: `select "userId", "createdAt" as at from "chatMessage"`,
  dating: `select "userId", "createdAt" as at from "drinkSwipe"`,
  trades: `select "fromId" as "userId", "createdAt" as at from "cardTrade"
    union all select "toId", "decidedAt" from "cardTrade" where status = 'accepted' and "decidedAt" is not null`,
  reviews: `select "userId", "createdAt" as at from review`,
  feed: `select "userId", "createdAt" as at from "profileComment"`,
  tracker: `select "userId", "createdAt" as at from "drinkLog"`,
};

/**
 * Members who used each feature, by Moscow day over `USAGE_DAYS`, over 7 and 30 days, plus how far «Лунный цикл» runs
 * get and how newcomers do with «Первые шаги». A repeat swipe moves `drinkSwipe.createdAt`, so dating counts the day of
 * the latest decision, as the swipe chart above does. Blocked members are left out.
 */
export async function getFeatureUsage(): Promise<AdminUsage> {
  const db = getPool();
  const events = USAGE_FEATURES.map(feature => `select '${feature.key}'::text as feature, e."userId", (e.at at time zone 'Europe/Moscow')::date as day
      from (${FEATURE_EVENTS[feature.key]}) e where e.at >= now() - interval '31 days'`).join('\n    union all ');
  const [byDay, reach, daily, steps] = await Promise.all([
    db.query<{ feature: UsageFeatureKey; day: string; members: number }>(`with ev as (${events}),
      days as (select generate_series(${TODAY} - ${USAGE_DAYS - 1}, ${TODAY}, interval '1 day')::date as day),
      features as (select unnest(array[${USAGE_FEATURES.map(feature => `'${feature.key}'`).join(', ')}]::text[]) as feature)
      select f.feature, to_char(d.day, 'YYYY-MM-DD') as day, count(distinct ev."userId")::int as members
      from features f cross join days d
      left join ev on ev.feature = f.feature and ev.day = d.day and ${LIVE('ev."userId"')}
      group by f.feature, d.day order by f.feature, d.day`),
    db.query<{ feature: UsageFeatureKey; week: number; month: number; active: number }>(`with ev as (${events})
      select ev.feature,
        (count(distinct ev."userId") filter (where ev.day > ${TODAY} - 7))::int as week,
        (count(distinct ev."userId") filter (where ev.day > ${TODAY} - 30))::int as month,
        (select count(distinct a."userId")::int from "activityDay" a where a.day > ${TODAY} - 7 and ${LIVE('a."userId"')}) as active
      from ev where ${LIVE('ev."userId"')} group by ev.feature`),
    db.query<Record<string, number>>(`with latest as (
        select distinct on (r."userId") r."userId", r.day, r.step from "dailyReward" r
        where ${LIVE('r."userId"')} order by r."userId", r.day desc
      )
      select (count(*) filter (where day >= ${TODAY} - 1))::int as alive,
        (count(*) filter (where day = ${TODAY}))::int as today,
        ${DAILY_MILESTONES.map(step => `(count(*) filter (where day >= ${TODAY} - 1 and step >= ${step}))::int as "reached_${step}"`).join(',\n        ')},
        (select count(distinct r."userId")::int from "dailyReward" r where r.step = 30 and ${LIVE('r."userId"')}) as finished,
        count(*)::int as ever
      from latest`),
    db.query<AdminUsage['firstSteps']>(`with n as (
        select u.id,
          exists(select 1 from "gachaPull" x where x."userId" = u.id) as pulled,
          (select count(*) from "drinkSwipe" x where x."userId" = u.id) >= ${FIRST_SWIPES} as swiped,
          exists(select 1 from "userFollow" x where x."userId" = u.id) as followed,
          exists(select 1 from "firstStepReward" x where x."userId" = u.id and x.step = 'swipes') as tag,
          exists(select 1 from "firstStepReward" x where x."userId" = u.id and x.step = 'follow') as frame
        from "user" u where u."createdAt" >= now() - interval '30 days' and ${LIVE('u.id')}
      )
      select count(*)::int as members, (count(*) filter (where pulled))::int as pulled, (count(*) filter (where swiped))::int as swiped,
        (count(*) filter (where followed))::int as followed, (count(*) filter (where pulled and swiped and followed))::int as "all",
        (count(*) filter (where tag))::int as tag, (count(*) filter (where frame))::int as frame
      from n`),
  ]);
  const activeWeek = reach.rows[0]?.active ?? 0;
  const dailyRow = daily.rows[0] ?? {};
  return {
    features: USAGE_FEATURES.map(feature => {
      const totals = reach.rows.find(row => row.feature === feature.key);
      return {
        key: feature.key,
        byDay: byDay.rows.filter(row => row.feature === feature.key).map(row => ({ day: row.day, members: row.members })),
        week: totals?.week ?? 0, month: totals?.month ?? 0,
      };
    }),
    // With no feature used in a month the reach query has no rows; the share base is then read on its own.
    activeWeek: reach.rows.length ? activeWeek : (await db.query<{ active: number }>(`select count(distinct a."userId")::int as active from "activityDay" a
      where a.day > ${TODAY} - 7 and ${LIVE('a."userId"')}`)).rows[0]?.active ?? 0,
    daily: {
      alive: Number(dailyRow.alive ?? 0), today: Number(dailyRow.today ?? 0),
      reached: Object.fromEntries(DAILY_MILESTONES.map(step => [step, Number(dailyRow[`reached_${step}`] ?? 0)])),
      finished: Number(dailyRow.finished ?? 0), ever: Number(dailyRow.ever ?? 0),
    },
    firstSteps: steps.rows[0] ?? { members: 0, pulled: 0, swiped: 0, followed: 0, all: 0, tag: 0, frame: 0 },
  };
}
