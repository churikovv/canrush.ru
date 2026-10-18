import { getPool } from '@/db/pool';
import { buildBrandCollections, collectionAwards, type CollectionSummary, type TriedDrink } from '@/lib/brand-collection-fields';
import { storeDrinkOptions } from '@/lib/store-catalog';

/** Drinks the member reviewed or logged from the catalog in the calendar. */
export async function getTriedDrinks(userId: string): Promise<TriedDrink[]> {
  const { rows } = await getPool().query<TriedDrink>(`select brand, flavor, 'review' as source from review where "userId" = $1
    union select brand, flavor, 'calendar' as source from "drinkLog" where "userId" = $1 and brand is not null`, [userId]);
  return rows;
}

/**
 * Collections with their XP settled: reached milestones are ledger rows keyed by brand and share,
 * so viewing, reviewing and logging can all settle them without paying twice. Returns new XP.
 */
export async function getBrandCollections(userId: string): Promise<CollectionSummary & { xp: number }> {
  const [options, tried] = await Promise.all([storeDrinkOptions(), getTriedDrinks(userId)]);
  const summary = buildBrandCollections(options, tried);
  const awards = collectionAwards(summary);
  if (!awards.length) return { ...summary, xp: 0 };
  const paid = await getPool().query<{ points: number }>(`insert into "profileExperience" ("userId", reason, "sourceKey", points)
    select $1, 'collection', a.key, a.points from unnest($2::text[], $3::int[]) as a(key, points)
    where not exists(select 1 from "userBlock" where "userId" = $1)
    on conflict do nothing returning points`, [userId, awards.map(item => item.key), awards.map(item => item.points)]);
  return { ...summary, xp: paid.rows.reduce((sum, row) => sum + row.points, 0) };
}
