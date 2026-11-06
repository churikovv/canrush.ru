import { isAssortmentFlavor } from '@canrush/shared';
import { getPool } from '@/db/pool';
import { canonicalDrink } from '@/lib/brand-collection-fields';
import { loadAllCatalogGroups } from '@/lib/catalog';
import { catalogGroupSlug, flavorName } from '@/lib/catalog-query';
import { getReviewSummaries } from '@/lib/reviews';
import { storeDrinkOptions, type StoreDrinkOption } from '@/lib/store-catalog';
import {
  AWARD, AWARD_CATEGORIES, awardCategory, awardPhase, awardScore, isAwardCategory, isSugarFreeDrink, seedNominees, voteBlock, voteShare,
  type AwardCategory, type AwardPhase, type RatedDrink,
} from '@/lib/awards-fields';

/** «Премия за энергию» (/awards, migration 0203): nominees, votes and results. Rules — `awards-fields.ts`. */
export class AwardError extends Error {}

const key = (brand: string, flavor: string) => JSON.stringify([brand, flavor]);
const NOT_BANNED = (column: string) => `not exists(select 1 from "userBlock" ub where ub."userId" = ${column})`;

/** Catalog drinks a vote may name: the same list as the drink pickers, without «в ассортименте». */
async function catalogOptions(): Promise<Map<string, StoreDrinkOption>> {
  return new Map((await storeDrinkOptions()).filter(option => !isAssortmentFlavor(option.flavor)).map(option => [key(option.brand, option.flavor), option]));
}

/**
 * The data's nominees, once per award: on the first visit after voting opens, from the members' reviews (blocked authors
 * left out, older identities counted for the current one). A second instance waits on the lock and finds them there.
 */
export async function ensureAwardNominees(): Promise<void> {
  const db = getPool();
  if ((await db.query(`select 1 from "awardNominee" where award = $1 and seeded limit 1`, [AWARD.key])).rowCount) return;
  const [options, reviews] = await Promise.all([catalogOptions(), db.query<RatedDrink>(
    `select r.brand, r.flavor, count(*)::int as reviews, avg(r.taste)::float8 as taste, avg(r.design)::float8 as design
     from review r where ${NOT_BANNED('r."userId"')} group by r.brand, r.flavor`)]);
  const drinks = new Map<string, RatedDrink>();
  for (const row of reviews.rows) {
    const identity = canonicalDrink(row.brand, row.flavor);
    const id = key(identity.brand, identity.flavor);
    if (!options.has(id)) continue;
    const before = drinks.get(id);
    const reviewsCount = (before?.reviews ?? 0) + row.reviews;
    drinks.set(id, {
      ...identity, reviews: reviewsCount,
      taste: ((before?.taste ?? 0) * (before?.reviews ?? 0) + row.taste * row.reviews) / reviewsCount,
      design: ((before?.design ?? 0) * (before?.reviews ?? 0) + row.design * row.reviews) / reviewsCount,
    });
  }
  const names = new Map([...options].map(([id, option]) => [id, `${option.label} ${option.fullName ?? ''}`]));
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`award-seed:${AWARD.key}`]);
    if (!(await client.query(`select 1 from "awardNominee" where award = $1 and seeded limit 1`, [AWARD.key])).rowCount) {
      for (const category of AWARD_CATEGORIES) {
        for (const drink of seedNominees(category.key, [...drinks.values()], names)) {
          await client.query(`insert into "awardNominee"(award, category, brand, flavor, seeded) values ($1, $2, $3, $4, true)
            on conflict (award, category, brand, flavor) do update set seeded = true`, [AWARD.key, category.key, drink.brand, drink.flavor]);
        }
      }
    }
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}

export interface AwardNomineeView {
  brand: string; flavor: string; name: string; slug: string; cover: string | null;
  /** Nominated by the data, not added by a member. */
  seeded: boolean;
  /** The viewer's vote in this category. */
  mine: boolean;
  /** Votes and share: only once the viewer voted in the category, or with the results. */
  votes: number | null; share: number | null;
  rating: { reviews: number; taste: number; design: number; overall: number };
}
export interface AwardCategoryView { key: AwardCategory; title: string; hint: string; revealed: boolean; total: number | null; nominees: AwardNomineeView[] }
export interface AwardBoard { phase: AwardPhase; voters: number; block: string | null; categories: AwardCategoryView[] }


/**
 * The page: every category with its nominees — the data's, and members' additions that have votes (or the viewer's own).
 * Before the viewer votes in a category it is ordered by the category's rating (the same Bayesian score that nominates)
 * and shows no counts, so the vote is not a race for the leader; after it (and with the results) by votes, a tie going
 * to the better score, with shares. Votes of blocked members don't count.
 */
export async function getAwardBoard(viewerId: string | null, now = Date.now()): Promise<AwardBoard> {
  const phase = awardPhase(now);
  const db = getPool();
  const [nominees, mine, voters, member, groups, means] = await Promise.all([
    db.query<{ category: AwardCategory; brand: string; flavor: string; seeded: boolean; votes: number }>(
      `select n.category, n.brand, n.flavor, n.seeded,
         count(v."userId") filter (where ${NOT_BANNED('v."userId"')})::int as votes
       from "awardNominee" n left join "awardVote" v on v.award = n.award and v.category = n.category and v.brand = n.brand and v.flavor = n.flavor
       where n.award = $1 group by n.category, n.brand, n.flavor, n.seeded`, [AWARD.key]),
    viewerId ? db.query<{ category: AwardCategory; brand: string; flavor: string }>(`select category, brand, flavor from "awardVote" where award = $1 and "userId" = $2`, [AWARD.key, viewerId]) : null,
    db.query<{ count: number }>(`select count(distinct v."userId")::int as count from "awardVote" v where v.award = $1 and ${NOT_BANNED('v."userId"')}`, [AWARD.key]),
    viewerId ? db.query<{ username: string | null; createdAt: Date; blocked: boolean }>(`select u.username, u."createdAt", not ${NOT_BANNED('u.id')} as blocked from "user" u where u.id = $1`, [viewerId]) : null,
    loadAllCatalogGroups(),
    db.query<{ taste: number; design: number }>(`select coalesce(avg(r.taste), 0)::float8 as taste, coalesce(avg(r.design), 0)::float8 as design from review r where ${NOT_BANNED('r."userId"')}`),
  ]);
  const mean = means.rows[0] ?? { taste: 0, design: 0 };
  const score = (rating: AwardNomineeView['rating'], category: AwardCategory) => {
    const { metric } = awardCategory(category);
    const average = metric === 'design' ? mean.design : metric === 'taste' ? mean.taste : (mean.taste + mean.design) / 2;
    return rating.reviews ? awardScore({ brand: '', flavor: '', reviews: rating.reviews, taste: rating.taste, design: rating.design }, metric, average) : -1;
  };
  const own = new Map((mine?.rows ?? []).map(row => [row.category, key(row.brand, row.flavor)]));
  const shown = nominees.rows.filter(row => row.seeded || row.votes > 0 || own.get(row.category) === key(row.brand, row.flavor));
  const [summaries, covers] = [await getReviewSummaries(shown.map(({ brand, flavor }) => ({ brand, flavor }))), new Map(groups.map(group => [key(group.brand, group.flavor), group.coverImageUrl ?? null]))];
  const categories = AWARD_CATEGORIES.map((category): AwardCategoryView => {
    const revealed = phase === 'results' || phase === 'over' || own.has(category.key);
    const rows = shown.filter(row => row.category === category.key);
    const total = rows.reduce((sum, row) => sum + row.votes, 0);
    const items = rows.map((row): AwardNomineeView => {
      const summary = summaries.get(`${row.brand}\u0000${row.flavor}`);
      return {
        brand: row.brand, flavor: row.flavor, name: flavorName(row.flavor), slug: catalogGroupSlug(row.brand, row.flavor), cover: covers.get(key(row.brand, row.flavor)) ?? null,
        seeded: row.seeded, mine: own.get(category.key) === key(row.brand, row.flavor),
        votes: revealed ? row.votes : null, share: revealed ? voteShare(row.votes, total) : null,
        rating: { reviews: summary?.count ?? 0, taste: summary?.taste ?? 0, design: summary?.design ?? 0, overall: summary?.overall ?? 0 },
      };
    }).sort((a, b) => (revealed ? (b.votes ?? 0) - (a.votes ?? 0) : 0) || score(b.rating, category.key) - score(a.rating, category.key)
      || b.rating.reviews - a.rating.reviews || a.brand.localeCompare(b.brand, 'ru'));
    return { key: category.key, title: category.title, hint: category.hint, revealed, total: revealed ? total : null, nominees: items };
  });
  const row = member?.rows[0];
  return {
    phase, voters: voters.rows[0]?.count ?? 0, categories,
    block: phase !== 'open' ? null : voteBlock(row ? { username: row.username, createdAt: row.createdAt, blocked: row.blocked } : null, now),
  };
}

/** The winner of each category for the results story: the most votes, a tie goes to the better rating. */
export async function getAwardWinners(): Promise<{ category: AwardCategory; title: string; brand: string; name: string; cover: string | null; share: number }[]> {
  const board = await getAwardBoard(null, Date.parse(AWARD.closesAt));
  return board.categories.flatMap(category => {
    const top = category.nominees[0];
    return top?.votes ? [{ category: category.key, title: category.title, brand: top.brand, name: top.name, cover: top.cover, share: top.share ?? 0 }] : [];
  });
}

/**
 * A vote, or a changed one. The drink is a nominee of the category, or any catalog drink — then the member adds it
 * (sugar-free ones only where the category asks). Locks the member's row so two quick taps don't race.
 */
export async function voteForDrink(userId: string, category: unknown, brand: unknown, flavor: unknown, now = Date.now()): Promise<{ brand: string; flavor: string }> {
  const phase = awardPhase(now);
  if (phase === 'upcoming') throw new AwardError('Голосование ещё не началось.');
  if (phase !== 'open') throw new AwardError('Голосование закончилось — итоги уже на странице премии.');
  if (!isAwardCategory(category)) throw new AwardError('Такой номинации нет.');
  const drink = { brand: String(brand ?? ''), flavor: String(flavor ?? '') };
  if (!drink.brand || !drink.flavor) throw new AwardError('Выберите напиток.');
  const options = await catalogOptions();
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { rows: [member] } = await client.query<{ username: string | null; createdAt: Date; blocked: boolean }>(
      `select u.username, u."createdAt", not ${NOT_BANNED('u.id')} as blocked from "user" u where u.id = $1 for no key update`, [userId]);
    const block = voteBlock(member ?? null, now);
    if (block) throw new AwardError(block);
    const nominated = (await client.query(`select 1 from "awardNominee" where award = $1 and category = $2 and brand = $3 and flavor = $4`, [AWARD.key, category, drink.brand, drink.flavor])).rowCount;
    if (!nominated) {
      const option = options.get(key(drink.brand, drink.flavor));
      if (!option) throw new AwardError('Такого напитка нет в каталоге. Выберите его из подсказок.');
      if (awardCategory(category).sugarFree && !isSugarFreeDrink(option.flavor, `${option.label} ${option.fullName ?? ''}`)) throw new AwardError('В этой номинации — только напитки без сахара.');
      await client.query(`insert into "awardNominee"(award, category, brand, flavor, "addedBy") values ($1, $2, $3, $4, $5) on conflict do nothing`, [AWARD.key, category, drink.brand, drink.flavor, userId]);
    }
    await client.query(`insert into "awardVote"(award, category, "userId", brand, flavor) values ($1, $2, $3, $4, $5)
      on conflict (award, category, "userId") do update set brand = excluded.brand, flavor = excluded.flavor, "updatedAt" = now()`, [AWARD.key, category, userId, drink.brand, drink.flavor]);
    await client.query('commit');
    return drink;
  } catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
