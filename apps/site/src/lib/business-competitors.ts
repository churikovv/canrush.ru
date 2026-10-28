import { getPool } from '@/db/pool';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { isCountedCatalogDrink } from '@/lib/home-metrics';
import { BusinessError } from '@/lib/business-fields';
import { brandSearchNames } from '@/lib/search-log-fields';
import { logBusiness } from '@/lib/business';

/** How many brands a company compares itself with. */
export const MAX_COMPETITORS = 3;

/** One side of the comparison: the company's own brands together, or one competitor brand. */
export interface BrandMetrics {
  label: string; brands: string[]; own: boolean;
  drinks: number; reviews: number; reviews30: number; score: number | null; taste: number | null; design: number | null;
  /** Share of right swipes among swipes, 0–1; null without swipes. */
  likeShare: number | null; swipes: number;
  searches30: number; views30: number; clicks30: number;
  /** Median price of half a litre over the catalog's offers with a volume, ₽; null without offers. */
  price500: number | null;
}

export interface Competitors { own: BrandMetrics | null; rivals: BrandMetrics[]; picked: string[]; options: string[]; suggested: string[] }

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const ownBrands = async (businessId: string) =>
  [...new Set((await getPool().query<{ brand: string }>(`select distinct brand from "businessDrink" where "businessId" = $1 and status = 'approved'`, [businessId])).rows.map(row => row.brand))]
    .sort((a, b) => a.localeCompare(b, 'ru-RU'));

/**
 * The same numbers for a set of brands (all their drinks, banned authors left out): catalog drinks, reviews and the
 * last 30 days, average scores, swipes, searches that showed or named a brand, card views and store taps for 30 days,
 * and the median price of 0.5 l.
 */
export async function brandMetrics(brands: string[], label: string, own: boolean, groups?: Awaited<ReturnType<typeof loadAllCatalogGroups>>): Promise<BrandMetrics> {
  const catalog = (groups ?? await loadAllCatalogGroups()).filter(group => brands.includes(group.brand) && isCountedCatalogDrink(group));
  const names = [...new Set(brands.flatMap(brandSearchNames))];
  const row = (await getPool().query<Omit<BrandMetrics, 'label' | 'brands' | 'own' | 'drinks' | 'price500'>>(
    `with r as (select * from review r where r.brand = any($1::text[]) and not exists(select 1 from "userBlock" b where b."userId" = r."userId"))
     select (select count(*)::int from r) as reviews,
       (select count(*)::int from r where "createdAt" > now() - interval '30 days') as reviews30,
       (select round(avg((taste + design) / 2.0)::numeric, 1)::float8 from r) as score,
       (select round(avg(taste)::numeric, 1)::float8 from r) as taste,
       (select round(avg(design)::numeric, 1)::float8 from r) as design,
       (select count(*)::int from "drinkSwipe" s where s.brand = any($1::text[])) as swipes,
       (select (count(*) filter (where liked))::float8 / nullif(count(*), 0) from "drinkSwipe" s where s.brand = any($1::text[])) as "likeShare",
       (select count(*)::int from "searchQuery" q where q."createdAt" > now() - interval '30 days'
          and (q.brands && $1::text[] or exists(select 1 from unnest($2::text[]) as n(name) where strpos(q.query, n.name) > 0))) as "searches30",
       (select count(*)::int from "catalogEvent" e where e.brand = any($1::text[]) and e.kind = 'view' and e."createdAt" > now() - interval '30 days') as "views30",
       (select count(*)::int from "catalogEvent" e where e.brand = any($1::text[]) and e.kind = 'store' and e."createdAt" > now() - interval '30 days') as "clicks30"`,
    [brands, names])).rows[0]!;
  const prices = catalog.flatMap(group => group.variants.filter(variant => variant.volumeMl && variant.price > 0).map(variant => variant.price / variant.volumeMl! * 500));
  const price = median(prices);
  return { ...row, label, brands, own, drinks: catalog.length, price500: price === null ? null : Math.round(price) };
}

/**
 * «Конкуренты» of the cabinet: the company's brands as one side, each picked competitor as another; the options are
 * the catalog's brands without the company's own, the suggestions — the most reviewed of them.
 */
export async function getCompetitors(businessId: string): Promise<Competitors> {
  const [brands, picked, groups] = await Promise.all([
    ownBrands(businessId),
    getPool().query<{ brand: string }>(`select brand from "businessCompetitor" where "businessId" = $1 order by "createdAt", brand`, [businessId]).then(result => result.rows.map(row => row.brand)),
    loadAllCatalogGroups(),
  ]);
  const options = [...new Set(groups.filter(isCountedCatalogDrink).map(group => group.brand))].filter(brand => !brands.includes(brand)).sort((a, b) => a.localeCompare(b, 'ru-RU'));
  const popular = (await getPool().query<{ brand: string }>(
    `select brand from review where brand = any($1::text[]) group by brand order by count(*) desc limit 8`, [options])).rows.map(row => row.brand);
  const [own, ...rivals] = await Promise.all([
    brands.length ? brandMetrics(brands, brands.length === 1 ? brands[0]! : 'Ваши бренды', true, groups) : Promise.resolve(null),
    ...picked.map(brand => brandMetrics([brand], brand, false, groups)),
  ]);
  return { own: own ?? null, rivals: rivals as BrandMetrics[], picked, options, suggested: popular.filter(brand => !picked.includes(brand)).slice(0, 5) };
}

/** Adds a competitor brand: a catalog brand, not the company's own, at most MAX_COMPETITORS. */
export async function addCompetitor(businessId: string, brand: string, userId: string | null = null): Promise<void> {
  const [brands, groups] = await Promise.all([ownBrands(businessId), loadAllCatalogGroups()]);
  const known = groups.find(group => isCountedCatalogDrink(group) && group.brand.toLowerCase() === brand.trim().toLowerCase())?.brand;
  if (!known) throw new BusinessError('Выберите бренд из каталога.');
  if (brands.includes(known)) throw new BusinessError('Это ваш бренд.');
  const result = await getPool().query(`insert into "businessCompetitor"("businessId", brand)
    select $1, $2 where (select count(*) from "businessCompetitor" where "businessId" = $1) < $3 on conflict do nothing`, [businessId, known, MAX_COMPETITORS]);
  if (!result.rowCount) {
    const exists = await getPool().query(`select 1 from "businessCompetitor" where "businessId" = $1 and brand = $2`, [businessId, known]);
    throw new BusinessError(exists.rowCount ? 'Этот бренд уже в сравнении.' : `Сравнивать можно до ${MAX_COMPETITORS} брендов.`);
  }  await logBusiness(businessId, userId, 'competitor', known);
}

export async function removeCompetitor(businessId: string, brand: string, userId: string | null = null): Promise<void> {
  const removed = await getPool().query(`delete from "businessCompetitor" where "businessId" = $1 and brand = $2`, [businessId, brand]);
  if (removed.rowCount) await logBusiness(businessId, userId, 'competitor-remove', brand);
}
