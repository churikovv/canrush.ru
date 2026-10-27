import { getPool } from '@/db/pool';

/**
 * The «Профиль оценок» radar, shared by the business cabinet and a drink's page: five 0–100 axes for some drinks
 * against the whole catalog — average taste and design ×10, share of 8+ reviews, share of right swipes in dating, and
 * share of member–drink pairs in calendars with a second can. Reviews of banned members are left out.
 */
export interface ScoreProfile { taste: number | null; design: number | null; high: number | null; liked: number | null; returning: number | null }

const NOT_BANNED = `not exists(select 1 from "userBlock" b where b."userId" = r."userId")`;
export function profileSql(filter: (alias: string) => string) {
  return `select
    (select round(avg(r.taste) * 10)::int from review r where ${filter('r')} and ${NOT_BANNED}) as taste,
    (select round(avg(r.design) * 10)::int from review r where ${filter('r')} and ${NOT_BANNED}) as design,
    (select round(100.0 * count(*) filter (where (r.taste + r.design) >= 16) / nullif(count(*), 0))::int from review r where ${filter('r')} and ${NOT_BANNED}) as high,
    (select round(100.0 * count(*) filter (where s.liked) / nullif(count(*), 0))::int from "drinkSwipe" s where ${filter('s')}) as liked,
    (select round(100.0 * count(*) filter (where n >= 2) / nullif(count(*), 0))::int from (select count(*) as n from "drinkLog" l where ${filter('l')} group by l."userId", l.brand, l.flavor) x) as returning`;
}

/** The profile of the given drinks. */
export async function getScoreProfile(drinks: { brand: string; flavor: string }[]): Promise<ScoreProfile> {
  return (await getPool().query<ScoreProfile>(
    profileSql(alias => `exists(select 1 from unnest($1::text[], $2::text[]) as t(brand, flavor) where t.brand = ${alias}.brand and t.flavor = ${alias}.flavor)`),
    [drinks.map(drink => drink.brand), drinks.map(drink => drink.flavor)])).rows[0]!;
}

const CATALOG_TTL_MS = 15 * 60_000;
let catalogCache: { expires: number; value: Promise<ScoreProfile> } | null = null;
/** The whole catalog's profile — the same for every page, so it is computed at most every 15 minutes per process. */
export function getCatalogScoreProfile(): Promise<ScoreProfile> {
  if (catalogCache && catalogCache.expires > Date.now()) return catalogCache.value;
  const value = getPool().query<ScoreProfile>(profileSql(alias => `${alias}.brand is not null`)).then(result => result.rows[0]!);
  catalogCache = { expires: Date.now() + CATALOG_TTL_MS, value: value.catch(error => { catalogCache = null; throw error; }) };
  return catalogCache.value;
}

/**
 * The radar in a drink's rating card: taste, design and their average (0–10), and «Избранное» — the share of people who
 * rated or favourited the drink that keep it in favourites (0–100), and «Страна» — the share of reviews naming the
 * drink's most common country (0–100; for the catalog — over all drinks, each counted against its own most common one).
 */
export interface DrinkRadar { taste: number | null; design: number | null; overall: number | null; favorite: number | null; country: number | null }

const RADAR_SQL = (filter: (alias: string) => string) => `select
    (select round(avg(r.taste), 1)::float8 from review r where ${filter('r')} and ${NOT_BANNED}) as taste,
    (select round(avg(r.design), 1)::float8 from review r where ${filter('r')} and ${NOT_BANNED}) as design,
    (select round(avg((r.taste + r.design) / 2.0), 1)::float8 from review r where ${filter('r')} and ${NOT_BANNED}) as overall,
    (select round(100.0 * count(*) filter (where f) / nullif(count(*), 0))::int from (
       select bool_or(kind = 'favorite') as f from (
         select r."userId", r.brand, r.flavor, 'review' as kind from review r where ${filter('r')}
         union all select fv."userId", fv.brand, fv.flavor, 'favorite' from favorite fv where ${filter('fv')}) x group by "userId", brand, flavor) y) as favorite,
    (select round(100.0 * sum(top) / nullif(sum(total), 0))::int from (
       select max(n) filter (where country is not null) as top, sum(n) as total from (
         select r.brand, r.flavor, r.country, count(*) as n from review r where ${filter('r')} and ${NOT_BANNED} group by 1, 2, 3) c
       group by brand, flavor having count(country) > 0) d) as country`;

export async function getDrinkRadar(brand: string, flavor: string): Promise<{ drink: DrinkRadar; catalog: DrinkRadar; country: string | null }> {
  const [drink, country, catalog] = await Promise.all([
    getPool().query<DrinkRadar>(RADAR_SQL(alias => `${alias}.brand = $1 and ${alias}.flavor = $2`), [brand, flavor]).then(result => result.rows[0]!),
    getPool().query<{ country: string }>(`select r.country from review r where r.brand = $1 and r.flavor = $2 and r.country is not null and ${NOT_BANNED}
      group by r.country order by count(*) desc, r.country limit 1`, [brand, flavor]).then(result => result.rows[0]?.country ?? null),
    getCatalogRadar(),
  ]);
  return { drink, catalog, country };
}

let radarCache: { expires: number; value: Promise<DrinkRadar> } | null = null;
function getCatalogRadar(): Promise<DrinkRadar> {
  if (radarCache && radarCache.expires > Date.now()) return radarCache.value;
  const value = getPool().query<DrinkRadar>(RADAR_SQL(alias => `${alias}.brand is not null`)).then(result => result.rows[0]!);
  radarCache = { expires: Date.now() + CATALOG_TTL_MS, value: value.catch(error => { radarCache = null; throw error; }) };
  return radarCache.value;
}
