import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const battle = await import('../src/lib/battle');
const gacha = await import('../src/lib/gacha');
const { PAID_WINS_PER_DAY, SPIN_RING_COST, WIN_RINGS } = await import('../src/lib/battle-fields');

const member = randomUUID(), other = randomUUID(), banned = randomUUID();
const brand = `Бой ${randomUUID().slice(0, 8)}`;
const drinks = Array.from({ length: 12 }, (_, index) => ({ brand, flavor: `f${index}`, name: `f${index}`, cover: `/images/${index}.jpg`, href: `/catalog/${index}`, rarity: 'common' as const, price: 50 + index * 10 }));
// Числа сезона общие на базу, поэтому тесты держат свой далёкий месяц и убирают его за собой.
const NOW = Date.UTC(2090, 5, 15);
const SEASON = '2090-06';

const win = async (id: string) => {
  const open = await battle.startBattle(id, drinks, NOW);
  await pool.query(`update "battle" set state = jsonb_set(state, '{rival,health}', '1') where id = $1`, [open.id]);
  const state = (await pool.query<{ state: { active: string; me: { mana: number } } }>('select state from "battle" where id = $1', [open.id])).rows[0]!.state;
  if (state.active !== 'me') throw new Error('rival is still moving');
  await pool.query(`update "battle" set state = jsonb_set(state, '{me,mana}', '2') where id = $1`, [open.id]);
  return { open, move: await battle.moveBattle(id, open.id, { kind: 'power' }) };
};

beforeAll(async () => {
  for (const id of [member, other, banned]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Battle test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `bt_${id.slice(0, 8)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
  await pool.query(`insert into "gachaCard"("userId", brand, flavor, rarity, count) values ($1, $2, 'f1', 'common', 2), ($1, $2, 'f2', 'common', 1)`, [member, brand]);
  await pool.query(`insert into review("userId", brand, flavor, design, taste, text) values ($1, $2, 'f1', 9, 9, 'Хороший вкус, беру снова')`, [member, brand]);
});
afterAll(async () => {
  await pool.query('delete from "battleCardStat" where season = $1', [SEASON]);
  await pool.query('delete from "user" where id = any($1::text[])', [[member, other, banned]]);
  await pool.end();
});

it('counts the season once: a later review does not change a card', async () => {
  const before = await battle.battleCatalog(drinks, NOW);
  expect(before).toHaveLength(drinks.length);
  await pool.query(`update review set taste = 1, design = 1 where "userId" = $1 and brand = $2`, [member, brand]);
  expect(await battle.battleCatalog(drinks, NOW)).toEqual(before);
});

it('builds the deck from own cards and shows it at home', async () => {
  const home = await battle.getBattleHome(member, drinks, NOW);
  expect(home).toMatchObject({ battle: null, rings: 0, paidLeft: PAID_WINS_PER_DAY, blocked: false });
  expect(home.deck).toHaveLength(15);
  expect(home.own).toBe(3);
});

it('keeps one running battle, hides the rival and closes it to others', async () => {
  const first = await battle.startBattle(member, drinks, NOW);
  const again = await battle.startBattle(member, drinks, NOW);
  expect((await gacha.getGachaState(member)).inBattle).toBe(true);
  expect(again.id).toBe(first.id);
  expect(first.view).not.toHaveProperty('rng');
  expect(first.view.rival).not.toHaveProperty('hand');
  expect(first.view.rival).not.toHaveProperty('deck');
  await expect(battle.moveBattle(other, first.id, { kind: 'end' })).rejects.toThrow('закончился');
  await expect(battle.startBattle(banned, drinks, NOW)).rejects.toThrow('заблокирован');
  await expect(battle.moveBattle(member, first.id, { kind: 'play', card: 'nope' })).rejects.toThrow('нет в руке');
});

it('plays the whole rival turn into frames that hide its hand', async () => {
  const { battle: running } = await battle.getBattleHome(member, drinks, NOW);
  const moved = await battle.moveBattle(member, running!.id, { kind: 'end' });
  expect(moved.frames.length).toBeGreaterThan(1);
  expect(moved.frames.at(-1)!.view.active).toBe('me');
  expect(moved.frames.at(-1)!.event).toMatchObject({ kind: 'turn', side: 'me' });
  for (const frame of moved.frames) expect(frame.view.rival).not.toHaveProperty('hand');
});

it('pays nothing for a surrender', async () => {
  const { battle: running } = await battle.getBattleHome(member, drinks, NOW);
  const moved = await battle.moveBattle(member, running!.id, { kind: 'surrender' });
  expect(moved.reward).toMatchObject({ won: false, earned: 0 });
  await expect(battle.moveBattle(member, running!.id, { kind: 'end' })).rejects.toThrow('закончился');
  expect((await pool.query<{ status: string }>('select status from "battle" where id = $1', [running!.id])).rows[0]!.status).toBe('lost');
  expect((await gacha.getGachaState(member)).inBattle).toBe(false);
  expect((await gacha.getGachaState(member)).rings).toBe(0);
});

it('pays rings for a win up to the daily limit, and crafts them into a spin the machine uses', async () => {
  await expect(battle.craftSpin(member)).rejects.toThrow(`Нужно ${SPIN_RING_COST} колечек`);
  for (let index = 1; index <= PAID_WINS_PER_DAY; index++) {
    const { move } = await win(member);
    expect(move.reward).toMatchObject({ won: true, earned: WIN_RINGS, rings: index * WIN_RINGS, paidLeft: PAID_WINS_PER_DAY - index });
  }
  const { move } = await win(member);
  expect(move.reward).toMatchObject({ won: true, earned: 0, rings: PAID_WINS_PER_DAY * WIN_RINGS, paidLeft: 0 });

  const before = await gacha.getGachaState(member);
  const crafted = await battle.craftSpin(member);
  expect(crafted.rings).toBe(before.rings - SPIN_RING_COST);
  expect(crafted.gifted).toBe(before.gifted + 1);

  await gacha.pullGacha(member, 1, drinks);
  const pulled = await gacha.pullGacha(member, 1, drinks);
  expect(pulled.state.gifted).toBe(before.gifted);
  expect(pulled.state.caps).toBe(before.caps);
});

it('refuses to craft for a blocked member', async () => {
  await pool.query(`insert into "ringLedger"("userId", reason, "sourceKey", amount) values ($1, 'battle', 'test', 6)`, [banned]);
  await expect(battle.craftSpin(banned)).rejects.toThrow('заблокирован');
});
