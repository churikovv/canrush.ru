import { getPool } from '@/db/pool';
import { BADGE_METRICS, earnedBadges, type BadgeProgress } from '@/lib/badges';

/**
 * Counts behind the achievements that are not tags, then stores the newly earned ones (kept for good, like tags) and
 * returns every one the member holds with its date. Called by the achievements screen, like tags are earned on view.
 */
export async function getBadges(userId: string): Promise<{ progress: BadgeProgress; earned: { key: string; earnedAt: Date }[] }> {
  const db = getPool();
  const { rows } = await db.query<Record<string, number>>(`select
    (select count(*)::int from "profileExperience" where "userId" = $1 and reason = 'collection' and "sourceKey" like '%:100') as "fullBrands",
    (select count(*)::int from "reviewCompanyReply" r join review v on v.id = r."reviewId" where v."userId" = $1) as "companyReplies",
    (select count(*)::int from "marketStore" where "ownerId" = $1 and status = 'published') as "storeCount",
    (select count(*)::int from article where "authorId" = $1 and status = 'published') as "publishedArticles",
    (select count(*)::int from "drinkAnswer" where "userId" = $1) as "drinkAnswers",
    (select count(*)::int from "collectionPhoto" where "userId" = $1) as "collectionPhotos",
    (select count(*)::int from "gachaPull" where "userId" = $1) as "gachaPulls",
    (select count(*)::int from "gachaCard" where "userId" = $1 and crafted) as "craftedCards",
    (select count(*)::int from battle where "userId" = $1 and status in ('won', 'lost')) as "battlesPlayed",
    (select count(*)::int from battle where "userId" = $1 and status = 'won') as "battleWins",
    (select count(*)::int from "capLedger" where "userId" = $1 and reason = 'quest' and "sourceKey" like '%:all') as "questDays"`, [userId]);
  const row = rows[0] ?? {};
  const progress = Object.fromEntries(BADGE_METRICS.map(metric => [metric, Number(row[metric] ?? 0)])) as BadgeProgress;
  const keys = earnedBadges(progress);
  const earned = await db.query<{ key: string; earnedAt: Date }>(`with added as (
      insert into "profileBadge" ("userId", key) select $1, unnest($2::text[]) on conflict do nothing returning key, "earnedAt")
    select key, "earnedAt" from added union all select key, "earnedAt" from "profileBadge" where "userId" = $1
    order by "earnedAt" desc, key`, [userId, keys]);
  return { progress, earned: earned.rows };
}
