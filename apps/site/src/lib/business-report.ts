import { getPool } from '@/db/pool';
import { flavorName } from '@/lib/catalog-query';
import { brandSearchNames } from '@/lib/search-log-fields';
import { isTelegramPlaceholderEmail } from '@/lib/telegram-init-data';

/** A value this week and the week before. */
export interface WeekPair { now: number; before: number }

export interface WeeklyReport {
  business: string;
  /** Monday of the reported week and its Sunday (Moscow dates). */
  from: string; to: string;
  reviews: WeekPair & { score: number | null };
  searches: WeekPair & { missed: number };
  views: WeekPair; clicks: WeekPair;
  /** The newest reviews of the week with text: drink, score, the first lines. */
  latest: { drink: string; score: number; text: string }[];
  /** Your brands and each competitor: reviews and card views this week. */
  rivals: { label: string; own: boolean; reviews: number; views: number }[];
}

const addDays = (day: string, days: number) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
/** The Monday that starts the week before the one `day` (a Moscow date) is in — the week a Monday report covers. */
export function reportedWeek(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((date.getUTCDay() + 6) % 7) - 7);
}

/**
 * The numbers of one week (Monday to Sunday, Moscow) against the week before, for the company's approved drinks and
 * brands: reviews and their average, searches with the brand (and how many found nothing), card views and store taps,
 * the three newest reviews with text, and a line per competitor. Banned authors are left out, as in the cabinet.
 */
export async function getWeeklyReport(businessId: string, from: string): Promise<WeeklyReport | null> {
  const db = getPool();
  const head = (await db.query<{ name: string }>(`select name from business where id = $1 and status = 'approved'`, [businessId])).rows[0];
  if (!head) return null;
  const drinks = (await db.query<{ brand: string; flavor: string }>(`select brand, flavor from "businessDrink" where "businessId" = $1 and status = 'approved'`, [businessId])).rows;
  if (!drinks.length) return null;
  const brands = [...new Set(drinks.map(row => row.brand))];
  const rivalBrands = (await db.query<{ brand: string }>(`select brand from "businessCompetitor" where "businessId" = $1 order by "createdAt", brand`, [businessId])).rows.map(row => row.brand);
  const names = [...new Set(brands.flatMap(brandSearchNames))];
  // Moscow midnights of the week before, this week and the next Monday.
  const bounds = `with w as (select ($3::date - 7)::timestamp at time zone 'Europe/Moscow' as a, $3::date::timestamp at time zone 'Europe/Moscow' as b, ($3::date + 7)::timestamp at time zone 'Europe/Moscow' as c)`;
  const mine = `exists(select 1 from unnest($1::text[], $2::text[]) as t(brand, flavor) where t.brand = r.brand and t.flavor = r.flavor)
    and not exists(select 1 from "userBlock" x where x."userId" = r."userId")`;
  const pair = (column: string) => `count(*) filter (where ${column} >= w.b and ${column} < w.c)::int as now, count(*) filter (where ${column} >= w.a and ${column} < w.b)::int as before`;
  const params = [drinks.map(row => row.brand), drinks.map(row => row.flavor), from];
  const [reviews, searches, events, latest, rivals] = await Promise.all([
    db.query<WeeklyReport['reviews']>(`${bounds} select ${pair('r."createdAt"')},
      round(avg((r.taste + r.design) / 2.0) filter (where r."createdAt" >= w.b and r."createdAt" < w.c)::numeric, 1)::float8 as score
      from review r, w where ${mine} and r."createdAt" >= w.a and r."createdAt" < w.c`, params),
    db.query<WeeklyReport['searches']>(`${bounds} select ${pair('q."createdAt"')},
      count(*) filter (where q."createdAt" >= w.b and q."createdAt" < w.c and q.results = 0)::int as missed
      from "searchQuery" q, w where q."createdAt" >= w.a and q."createdAt" < w.c
        and (q.brands && $1::text[] or exists(select 1 from unnest($2::text[]) as n(name) where strpos(q.query, n.name) > 0))`, [brands, names, from]),
    db.query<{ kind: string; now: number; before: number }>(`${bounds} select e.kind, ${pair('e."createdAt"')}
      from "catalogEvent" e, w where exists(select 1 from unnest($1::text[], $2::text[]) as t(brand, flavor) where t.brand = e.brand and t.flavor = e.flavor)
        and e."createdAt" >= w.a and e."createdAt" < w.c group by e.kind`, params),
    db.query<{ brand: string; flavor: string; score: number; text: string }>(`${bounds} select r.brand, r.flavor, round((r.taste + r.design) / 2.0, 1)::float8 as score, r.text
      from review r, w where ${mine} and r."createdAt" >= w.b and r."createdAt" < w.c and length(trim(r.text)) > 0
      order by r."createdAt" desc limit 3`, params),
    db.query<{ label: string; reviews: number; views: number }>(`${bounds} select s.label,
        (select count(*)::int from review r where r.brand = any(s.brands) and r."createdAt" >= w.b and r."createdAt" < w.c
           and not exists(select 1 from "userBlock" x where x."userId" = r."userId")) as reviews,
        (select count(*)::int from "catalogEvent" e where e.brand = any(s.brands) and e.kind = 'view' and e."createdAt" >= w.b and e."createdAt" < w.c) as views
      from w, (select 0 as n, $4::text as label, $1::text[] as brands union all select o.n, o.brand, array[o.brand] from unnest($2::text[]) with ordinality as o(brand, n)) s
      order by s.n`, [brands, rivalBrands, from, brands.length === 1 ? brands[0] : 'Ваши бренды']),
  ]);
  const event = (kind: string) => { const row = events.rows.find(item => item.kind === kind); return { now: row?.now ?? 0, before: row?.before ?? 0 }; };
  return {
    business: head.name, from, to: addDays(from, 6),
    reviews: reviews.rows[0]!, searches: searches.rows[0]!, views: event('view'), clicks: event('store'),
    latest: latest.rows.map(row => ({ drink: `${row.brand} · ${flavorName(row.flavor)}`, score: row.score, text: row.text.trim().replace(/\s+/g, ' ').slice(0, 220) })),
    rivals: rivalBrands.length ? rivals.rows.map((row, index) => ({ ...row, own: index === 0 })) : [],
  };
}

type ReportMail = (to: string, report: WeeklyReport) => Promise<void>;

/**
 * Sends the report of the week starting `from` to the owner and the active team of every approved company with
 * approved drinks — unless they turned it off, are banned or have only a Telegram placeholder address. Each letter is
 * claimed in `businessWeeklyReport` first, so a second pass or another instance sends nothing twice; a failed letter
 * is marked and not retried. A pause between letters keeps the SMTP calm.
 */
export async function runWeeklyReports(from: string, send?: ReportMail, pauseMs = 1500): Promise<{ sent: number; failed: number }> {
  const db = getPool();
  const mail = send ?? (await import('@/lib/email')).sendBusinessWeeklyEmail;
  const recipients = (await db.query<{ businessId: string; userId: string; email: string }>(
    `select b.id as "businessId", u.id as "userId", u.email
     from business b
     join lateral (select b."ownerId" as id union select m."userId" from "businessMember" m where m."businessId" = b.id and m.status = 'active') t on true
     join "user" u on u.id = t.id
     where b.status = 'approved' and exists(select 1 from "businessDrink" d where d."businessId" = b.id and d.status = 'approved')
       and not exists(select 1 from "businessReportOptOut" o where o."userId" = u.id)
       and not exists(select 1 from "userBlock" x where x."userId" = u.id)
       and not exists(select 1 from "businessWeeklyReport" r where r."businessId" = b.id and r."userId" = u.id and r.week = $1)
     order by b.id`, [from])).rows.filter(row => row.email && !isTelegramPlaceholderEmail(row.email));
  const reports = new Map<string, WeeklyReport | null>();
  let sent = 0, failed = 0;
  for (const row of recipients) {
    if (!reports.has(row.businessId)) reports.set(row.businessId, await getWeeklyReport(row.businessId, from));
    const report = reports.get(row.businessId);
    if (!report) continue;
    const claimed = await db.query(`insert into "businessWeeklyReport"("businessId", "userId", week) values ($1, $2, $3) on conflict do nothing`, [row.businessId, row.userId, from]);
    if (!claimed.rowCount) continue;
    try { await mail(row.email, report); sent++; }
    catch (error) {
      failed++;
      await db.query(`update "businessWeeklyReport" set "failedAt" = now() where "businessId" = $1 and "userId" = $2 and week = $3`, [row.businessId, row.userId, from]).catch(() => undefined);
      console.error('[business-report] letter failed', error instanceof Error ? error.message : 'unknown');
    }
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  return { sent, failed };
}
