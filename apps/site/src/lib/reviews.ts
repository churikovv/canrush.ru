import { getReviewInteractions, type ReviewInteraction } from './review-discussions';
import type { QueryResultRow } from 'pg';
import type { PreparedReviewPhoto } from './review-photos';
import { MAX_REVIEW_PHOTOS, PHOTO_ID_PATTERN } from './review-photo-limits';
import { profileTagLabel } from '@/lib/profile-achievements';
import { getPool } from '@/db/pool';

export interface ReviewAuthor {
  username: string;
  name: string;
  telegramChannel: string | null;
  tag: string | null;
  avatarId: string | null;
  xp?: number;
}

export interface ReviewData {
  interaction?: ReviewInteraction;
  id: string;
  author: ReviewAuthor;
  photos: string[];
  brand: string;
  flavor: string;
  design: number;
  taste: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewSummary {
  count: number;
  design: number;
  taste: number;
  overall: number;
}

export interface ReviewInput {
  design: number;
  taste: number;
  text: string;
}

const EMPTY_SUMMARY: ReviewSummary = { count: 0, design: 0, taste: 0, overall: 0 };

interface ReviewRow extends QueryResultRow {
  photos: string[];
  id: string;
  brand: string;
  flavor: string;
  design: number;
  taste: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  name: string;
  telegramChannel: string | null;
  tag: string | null;
  avatarId: string | null;
  xp?: number;
}

const REVIEW_SELECT = `
  select r."id", r."brand", r."flavor", r."design", r."taste", r."text",
         r."createdAt", r."updatedAt",
         array(select p."id"::text from "reviewPhoto" p where p."reviewId" = r."id" order by p."position") as photos,
         u."username", u."name", u."telegramChannel",
         coalesce((select xp from "profileRanking" where id=u.id),0) as xp,
         (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
         case when u."profileTags"[1] = 'admin' then
           case when exists(select 1 from "siteAdmin" where email = lower(u.email)) then 'admin' end
         when exists(select 1 from "profileAchievement" where "userId" = u.id and key = u."profileTags"[1]) then u."profileTags"[1] end as tag
  from "review" r
  join "user" u on u."id" = r."userId"
`;

function toReview(row: ReviewRow): ReviewData {
  return {
    id: row.id,
    photos: row.photos,
    author: {
      username: row.username,
      name: row.name,
      telegramChannel: row.telegramChannel,
      tag: profileTagLabel(row.tag) ?? null,
      avatarId: row.avatarId,
      xp: row.xp ?? 0,
    },
    brand: row.brand,
    flavor: row.flavor,
    design: Number(row.design),
    taste: Number(row.taste),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getReviewsForProduct(brand: string, flavor: string, viewer: string | null = null): Promise<ReviewData[]> {
  const result = await getPool().query<ReviewRow>(
    `${REVIEW_SELECT} where r."brand" = $1 and r."flavor" = $2 order by r."createdAt" desc`,
    [brand, flavor],
  );
  const interactions = await getReviewInteractions(result.rows.map(row => row.id), viewer);
  return result.rows.map(row => ({ ...toReview(row), interaction: interactions.get(row.id) }));
}

export async function getReviewSummary(brand: string, flavor: string): Promise<ReviewSummary> {
  const result = await getPool().query(
    `select count(*)::int as count,
       coalesce(avg("design"), 0)::float8 as design,
       coalesce(avg("taste"), 0)::float8 as taste
     from "review" where "brand" = $1 and "flavor" = $2`,
    [brand, flavor],
  );
  const row = result.rows[0];
  if (!row || row.count === 0) return EMPTY_SUMMARY;
  const design = Number(row.design);
  const taste = Number(row.taste);
  return {
    count: row.count,
    design,
    taste,
    overall: (design + taste) / 2,
  };
}

export async function getReviewSummaries(
  products: Array<{ brand: string; flavor: string }>,
): Promise<Map<string, ReviewSummary>> {
  const summaries = new Map<string, ReviewSummary>();
  if (products.length === 0) return summaries;

  const rows = await getPool().query(
    `select "brand", "flavor",
       count(*)::int as count,
       coalesce(avg("design"), 0)::float8 as design,
       coalesce(avg("taste"), 0)::float8 as taste
     from "review"
     where ("brand", "flavor") in (
       ${products.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')}
     )
     group by "brand", "flavor"`,
    products.flatMap((p) => [p.brand, p.flavor]),
  );

  for (const row of rows.rows) {
    const design = Number(row.design);
    const taste = Number(row.taste);
    summaries.set(`${row.brand}\u0000${row.flavor}`, {
      count: row.count,
      design,
      taste,
      overall: (design + taste) / 2,
    });
  }
  return summaries;
}

export async function getUserReview(userId: string, brand: string, flavor: string): Promise<ReviewData | null> {
  const result = await getPool().query<ReviewRow>(
    `${REVIEW_SELECT} where r."userId" = $1 and r."brand" = $2 and r."flavor" = $3 limit 1`,
    [userId, brand, flavor],
  );
  const row = result.rows[0];
  return row ? toReview(row) : null;
}

export async function getReviewCountForUser(userId: string): Promise<number> {
  const result = await getPool().query('select count(*)::int as count from "review" where "userId" = $1', [userId]);
  return Number(result.rows[0]?.count ?? 0);
}

export async function upsertReview(
  userId: string,
  brand: string,
  flavor: string,
  input: ReviewInput,
  attachments?: { retained: string[]; photos: PreparedReviewPhoto[] },
): Promise<string[]> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await client.query<{ id: string }>(
      `insert into "review" ("userId", "brand", "flavor", "design", "taste", "text")
       values ($1, $2, $3, $4, $5, $6)
       on conflict ("userId", "brand", "flavor")
       do update set "design" = excluded."design", "taste" = excluded."taste",
         "text" = excluded."text", "updatedAt" = current_timestamp
       returning "id"`,
      [userId, brand, flavor, input.design, input.taste, input.text],
    );
    const reviewId = result.rows[0]!.id;
    if (attachments) {
      const { retained, photos } = attachments;
      if (retained.length + photos.length > MAX_REVIEW_PHOTOS || new Set(retained).size !== retained.length || retained.some(id => !PHOTO_ID_PATTERN.test(id))) throw new Error('Invalid photo selection');
      const owned = await client.query<{ id: string }>('select "id" from "reviewPhoto" where "reviewId" = $1', [reviewId]);
      if (retained.some(id => !owned.rows.some(row => row.id === id))) throw new Error('Photo does not belong to this review');
      await client.query('delete from "reviewPhoto" where "reviewId" = $1 and not ("id" = any($2::uuid[]))', [reviewId, retained]);
      // Retained photos keep their order/slots; new photos fill free slots. The parent upsert serializes edits.
      const occupied = await client.query<{ position: number }>('select "position" from "reviewPhoto" where "reviewId" = $1', [reviewId]);
      const slots = new Set(occupied.rows.map(row => row.position));
      for (const photo of photos) {
        let position = 0;
        while (slots.has(position)) position++;
        await client.query('insert into "reviewPhoto" ("reviewId", "position", "data", "thumbnail") values ($1, $2, $3, $4)', [reviewId, position, photo.data, photo.thumbnail]);
        slots.add(position);
      }
    }
    const saved = await client.query<{ id: string }>('select "id" from "reviewPhoto" where "reviewId" = $1 order by "position"', [reviewId]);
    await client.query('commit');
    return saved.rows.map(row => row.id);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteReview(userId: string, brand: string, flavor: string): Promise<void> {
  await getPool().query(
    'delete from "review" where "userId" = $1 and "brand" = $2 and "flavor" = $3',
    [userId, brand, flavor],
  );
}


export const PROFILE_REVIEWS_PAGE_SIZE = 20;

export async function getReviewsForUser(userId: string, page = 1, viewer: string | null = null): Promise<ReviewData[]> {
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const result = await getPool().query<ReviewRow>(
    `${REVIEW_SELECT} where r."userId" = $1 order by r."createdAt" desc, r."id" desc limit $2 offset $3`,
    [userId, PROFILE_REVIEWS_PAGE_SIZE, (safePage - 1) * PROFILE_REVIEWS_PAGE_SIZE],
  );
  const interactions = await getReviewInteractions(result.rows.map(row => row.id), viewer);
  return result.rows.map(row => ({ ...toReview(row), interaction: interactions.get(row.id) }));
}

export async function getDiscussionCounts(): Promise<Map<string, number>> {
  const { rows } = await getPool().query(`select r.brand, r.flavor,
    (count(distinct r.id) + count(c.id))::int as count
    from review r left join "reviewComment" c on c."reviewId"=r.id
    group by r.brand,r.flavor`);
  return new Map(rows.map(row => [`${row.brand}\u0000${row.flavor}`, Number(row.count)]));
}

export async function getLatestReviewPreview(userId: string): Promise<string | null> {
  const { rows } = await getPool().query<{ text: string }>(
    `select left(text, 240) as text from review where "userId" = $1 and length(trim(text)) > 0 order by "createdAt" desc, id desc limit 1`, [userId],
  );
  return rows[0]?.text ?? null;
}
