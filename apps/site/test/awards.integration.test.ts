import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// The catalog is this test's brand only: four drinks, one without sugar.
const fixture = vi.hoisted(() => {
  const brand = `Премия ${Math.random().toString(16).slice(2, 10)}`;
  const option = (flavor: string, name: string) => ({ brand, flavor, label: `${brand} · ${name}` });
  return { brand, options: [option('mango', 'Манго'), option('cherry', 'Вишня'), option('mango:sugarfree', 'Манго · без сахара'), option('lemon', 'Лимон')] };
});
vi.mock('@/lib/store-catalog', () => ({ storeDrinkOptions: async () => fixture.options }));
vi.mock('@/lib/catalog', () => ({ loadAllCatalogGroups: async () => [] }));
const { AwardError, ensureAwardNominees, getAwardBoard, getAwardWinners, voteForDrink } = await import('../src/lib/awards');
const { AWARD } = await import('../src/lib/awards-fields');

const { brand } = fixture;
const [voter, second, fresh, nameless, banned, r1, r2, r3] = Array.from({ length: 8 }, () => randomUUID()) as [string, string, string, string, string, string, string, string];
const everyone = [voter, second, fresh, nameless, banned, r1, r2, r3];
const now = Date.parse('2026-12-01T12:00:00+03:00');
const category = (board: Awaited<ReturnType<typeof getAwardBoard>>, key: string) => board.categories.find(item => item.key === key)!;

beforeAll(async () => {
  await pool.query('delete from "awardNominee" where award = $1', [AWARD.key]);
  for (const id of everyone) {
    await pool.query(`insert into "user"(id, name, email, "emailVerified", "createdAt", "updatedAt", username) values ($1, 'Премия', $2, true, $3, now(), $4)`,
      [id, `${id}@example.com`, new Date(now - (id === fresh ? 1 : 10) * 86_400_000), id === nameless ? null : `aw_${id.slice(0, 12)}`]);
  }
  await pool.query('insert into "userBlock" ("userId") values ($1)', [banned]);
  // Three reviewers: mango is loved, cherry is fine, the sugar-free mango is good; lemon has one review — not enough.
  for (const [id, mango, cherry, zero] of [[r1, 9, 6, 8], [r2, 9, 6, 7], [r3, 8, 5, 8]] as const) {
    await pool.query(`insert into review ("userId", brand, flavor, design, taste, text) values ($1, $2, 'mango', $3, $3, 'Отзыв'), ($1, $2, 'cherry', $4, $4, 'Отзыв'), ($1, $2, 'mango:sugarfree', $5, $5, 'Отзыв')`, [id, brand, mango, cherry, zero]);
  }
  await pool.query(`insert into review ("userId", brand, flavor, design, taste, text) values ($1, $2, 'lemon', 10, 10, 'Отзыв')`, [r1, brand]);
});

afterAll(async () => {
  await pool.query('delete from "awardNominee" where award = $1', [AWARD.key]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('nominates the best drinks by reviews once, and keeps «без сахара» to sugar-free ones', async () => {
  await ensureAwardNominees();
  await ensureAwardNominees();
  const { rows } = await pool.query<{ category: string; flavor: string }>(`select category, flavor from "awardNominee" where award = $1 and brand = $2 order by category, flavor`, [AWARD.key, brand]);
  const by = (key: string) => rows.filter(row => row.category === key).map(row => row.flavor);
  expect(by('drink')).toEqual(['cherry', 'mango', 'mango:sugarfree']);
  expect(by('sugarfree')).toEqual(['mango:sugarfree']);
  expect(rows.map(row => row.flavor)).not.toContain('lemon');
  const board = await getAwardBoard(voter, now);
  expect(category(board, 'drink').nominees.map(item => item.flavor)).toEqual(['mango', 'mango:sugarfree', 'cherry']);
  // Before one's own vote, no counts: the choice is one's own.
  expect(category(board, 'drink')).toMatchObject({ revealed: false, total: null });
  expect(category(board, 'drink').nominees[0]).toMatchObject({ votes: null, share: null, rating: { reviews: 3 } });
  expect(board.block).toBeNull();
});

it('takes one vote per category from members with a nickname and a few days on the site', async () => {
  await expect(voteForDrink(fresh, 'drink', brand, 'mango', now)).rejects.toThrow('через 3 дня');
  await expect(voteForDrink(nameless, 'drink', brand, 'mango', now)).rejects.toThrow('ник');
  await expect(voteForDrink(banned, 'drink', brand, 'mango', now)).rejects.toThrow('заблокирован');
  await expect(voteForDrink(voter, 'best', brand, 'mango', now)).rejects.toThrow('номинации нет');
  await expect(voteForDrink(voter, 'drink', brand, 'mango', Date.parse(AWARD.closesAt))).rejects.toThrow('закончилось');

  await voteForDrink(voter, 'drink', brand, 'mango', now);
  await voteForDrink(second, 'drink', brand, 'cherry', now);
  const board = await getAwardBoard(voter, now);
  expect(category(board, 'drink')).toMatchObject({ revealed: true, total: 2 });
  expect(category(board, 'drink').nominees.map(item => [item.flavor, item.votes, item.share, item.mine])).toEqual([
    ['mango', 1, 50, true], ['cherry', 1, 50, false], ['mango:sugarfree', 0, 0, false],
  ]);
  expect(category(board, 'taste').revealed).toBe(false);
  expect(board.voters).toBe(2);
});

it('lets a member add a catalog drink as their vote, moves the vote, and holds the sugar-free rule', async () => {
  await expect(voteForDrink(voter, 'drink', brand, 'kiwi', now)).rejects.toBeInstanceOf(AwardError);
  await expect(voteForDrink(voter, 'sugarfree', brand, 'cherry', now)).rejects.toThrow('без сахара');
  await voteForDrink(voter, 'drink', brand, 'lemon', now);
  expect((await pool.query(`select "addedBy" from "awardNominee" where award = $1 and category = 'drink' and brand = $2 and flavor = 'lemon'`, [AWARD.key, brand])).rows).toEqual([{ addedBy: voter }]);
  const drink = category(await getAwardBoard(second, now), 'drink');
  // One vote each: the tie goes to the better score (lemon's single 10 over cherry's three 5–6), then the unvoted by score.
  expect(drink.nominees.map(item => [item.flavor, item.votes, item.seeded])).toEqual([['lemon', 1, false], ['cherry', 1, true], ['mango', 0, true], ['mango:sugarfree', 0, true]]);

  // A blocked member's vote doesn't count; a drink merge carries the votes to the kept drink.
  await pool.query(`insert into "awardVote"(award, category, "userId", brand, flavor) values ($1, 'drink', $2, $3, 'cherry')`, [AWARD.key, banned, brand]);
  expect(category(await getAwardBoard(second, now), 'drink').nominees.find(item => item.flavor === 'cherry')).toMatchObject({ votes: 1 });
  await pool.query('select move_drink_identity($1, $2, $1, $3)', [brand, 'lemon', 'mango']);
  const merged = category(await getAwardBoard(voter, now), 'drink');
  expect(merged.nominees.find(item => item.flavor === 'mango')).toMatchObject({ votes: 1, mine: true });
  expect(merged.nominees.map(item => item.flavor)).not.toContain('lemon');
});

it('names a winner per category once voting is over', async () => {
  const winners = await getAwardWinners();
  const ours = winners.filter(winner => winner.brand === brand);
  expect(ours.map(winner => winner.category)).toEqual(['drink']);
  // A tie of one vote each goes to the better rating: mango (8.7) over cherry (5.7).
  expect(ours[0]).toMatchObject({ name: 'Манго', share: 50 });
});
