import type { QueryResultRow } from 'pg';
import { getPool } from '@/db/pool';

export interface ReviewAuthor {
  username: string;
  name: string;
  telegramChannel: string | null;
}

export interface ReviewData {
  id: string;
  author: ReviewAuthor;
  brand: string;
  flavor: string;
  design: number;
  taste: number;
  composition: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewSummary {
  count: number;
  design: number;
  taste: number;
  composition: number;
  overall: number;
}

export interface ReviewInput {
  design: number;
  taste: number;
  composition: number;
  text: string;
}

const EMPTY_SUMMARY: ReviewSummary = { count: 0, design: 0, taste: 0, composition: 0, overall: 0 };

interface ReviewRow extends QueryResultRow {
  id: string;
  brand: string;
  flavor: string;
  design: number;
  taste: number;
  composition: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  name: string;
  telegramChannel: string | null;
}

const REVIEW_SELECT = `
  select r."id", r."brand", r."flavor", r."design", r."taste", r."composition", r."text",
         r."createdAt", r."updatedAt",
         u."username", u."name", u."telegramChannel"
  from "review" r
  join "user" u on u."id" = r."userId"
`;

function toReview(row: ReviewRow): ReviewData {
  return {
    id: row.id,
    author: {
      username: row.username,
      name: row.name,
      telegramChannel: row.telegramChannel,
    },
    brand: row.brand,
    flavor: row.flavor,
    design: Number(row.design),
    taste: Number(row.taste),
    composition: Number(row.composition),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getReviewsForProduct(brand: string, flavor: string): Promise<ReviewData[]> {
  const result = await getPool().query<ReviewRow>(
    `${REVIEW_SELECT} where r."brand" = $1 and r."flavor" = $2 order by r."createdAt" desc`,
    [brand, flavor],
  );
  return result.rows.map(toReview);
}

export async function getReviewSummary(brand: string, flavor: string): Promise<ReviewSummary> {
  const result = await getPool().query(
    `select count(*)::int as count,
       coalesce(avg("design"), 0)::float8 as design,
       coalesce(avg("taste"), 0)::float8 as taste,
       coalesce(avg("composition"), 0)::float8 as composition
     from "review" where "brand" = $1 and "flavor" = $2`,
    [brand, flavor],
  );
  const row = result.rows[0];
  if (!row || row.count === 0) return EMPTY_SUMMARY;
  const design = Number(row.design);
  const taste = Number(row.taste);
  const composition = Number(row.composition);
  return {
    count: row.count,
    design,
    taste,
    composition,
    overall: (design + taste + composition) / 3,
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
       coalesce(avg("taste"), 0)::float8 as taste,
       coalesce(avg("composition"), 0)::float8 as composition
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
    const composition = Number(row.composition);
    summaries.set(`${row.brand}\u0000${row.flavor}`, {
      count: row.count,
      design,
      taste,
      composition,
      overall: (design + taste + composition) / 3,
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
): Promise<void> {
  await getPool().query(
    `insert into "review" ("userId", "brand", "flavor", "design", "taste", "composition", "text")
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict ("userId", "brand", "flavor")
     do update set "design" = excluded."design",
                   "taste" = excluded."taste",
                   "composition" = excluded."composition",
                   "text" = excluded."text",
                   "updatedAt" = current_timestamp`,
    [userId, brand, flavor, input.design, input.taste, input.composition, input.text],
  );
}

export async function deleteReview(userId: string, brand: string, flavor: string): Promise<void> {
  await getPool().query(
    'delete from "review" where "userId" = $1 and "brand" = $2 and "flavor" = $3',
    [userId, brand, flavor],
  );
}
