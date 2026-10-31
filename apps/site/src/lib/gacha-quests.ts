import type { getPool } from '@/db/pool';
import { questBoard, type QuestBoard, type QuestKey } from '@/lib/gacha-quests-fields';

interface Queryable { query: ReturnType<typeof getPool>['query'] }

/** Today's board of one member: real actions of the Moscow day, one query over user indexes and the ledger's key. */
export async function loadQuestBoard(db: Queryable, userId: string, day: string): Promise<QuestBoard> {
  const { rows } = await db.query<Record<QuestKey, number> & { claimed: string[] }>(`with moment as (select ($2::date)::timestamp at time zone 'Europe/Moscow' as start)
    select
      (select count(*) from "gachaPull" p, moment m where p."userId" = $1 and p."createdAt" >= m.start)::int as spin,
      (select count(*) from "drinkSwipe" s, moment m where s."userId" = $1 and s."createdAt" >= m.start)::int as swipes,
      ((select count(*) from "reviewComment" c, moment m where c."userId" = $1 and c."createdAt" >= m.start)
        + (select count(*) from "tierListComment" c, moment m where c."userId" = $1 and c."createdAt" >= m.start)
        + (select count(*) from "wallReply" c, moment m where c."userId" = $1 and c."createdAt" >= m.start))::int as comment,
      (select count(*) from favorite f, moment m where f."userId" = $1 and f."createdAt" >= m.start)::int as favorite,
      (select count(*) from review r, moment m where r."userId" = $1 and r."createdAt" >= m.start)::int as review,
      array(select "sourceKey" from "capLedger" where "userId" = $1 and reason = 'quest' and "sourceKey" like $2 || ':%') as claimed`, [userId, day]);
  const { claimed, ...counts } = rows[0]!;
  return questBoard(day, counts, new Set(claimed));
}
