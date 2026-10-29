import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const gacha = await import('../src/lib/gacha');

const member = randomUUID(), banned = randomUUID(), merger = randomUUID();
const brand = `Гача ${randomUUID().slice(0, 8)}`;
const drinks = (['common', 'rare', 'epic', 'legendary'] as const).map(rarity => ({ brand, flavor: rarity, name: rarity, cover: `/images/${rarity}.jpg`, href: `/catalog/${rarity}`, rarity }));
const caps = async (id: string) => (await pool.query<{ reason: string; amount: number }>(
  'select reason, sum(amount)::int as amount from "capLedger" where "userId" = $1 group by reason order by reason', [id])).rows;

beforeAll(async () => {
  for (const id of [member, banned, merger]) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Gacha test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `ga_${id.slice(0, 12)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [[member, banned, merger]]);
  await pool.end();
});

it('welcomes once, gives one free pull a day, then charges caps and refuses without them', async () => {
  const state = await gacha.getGachaState(member);
  expect(state).toMatchObject({ caps: 30, free: true, cards: 0 });
  expect((await gacha.getGachaState(member)).caps).toBe(30);

  const free = await gacha.pullGacha(member, 1, drinks);
  expect(free.cards).toHaveLength(1);
  expect(free.cards[0]).toMatchObject({ brand, isNew: true, count: 1 });
  expect(free.state).toMatchObject({ caps: 30, free: false, cards: 1 });

  const paid = await gacha.pullGacha(member, 1, drinks);
  expect(paid.state.caps).toBe(20);
  await expect(gacha.pullGacha(member, 10, drinks)).rejects.toThrow('Не хватает крышек');
  await gacha.pullGacha(member, 1, drinks);
  await gacha.pullGacha(member, 1, drinks);
  await expect(gacha.pullGacha(member, 1, drinks)).rejects.toThrow('Не хватает крышек');
  expect((await gacha.getGachaState(member)).caps).toBe(0);
  await expect(gacha.pullGacha(banned, 1, drinks)).rejects.toThrow('заблокирован');
});

it('ten pulls hit the epic guarantee and the album counts cards by rarity', async () => {
  await pool.query(`insert into "capLedger"("userId", reason, "sourceKey", amount) values ($1, 'welcome', 'test-top-up', 900)`, [member]);
  // Only commons in the pool below epic: the tenth pull still pays out the best the pool has.
  const pulls = await gacha.pullGacha(member, 10, drinks.filter(drink => drink.rarity !== 'legendary'));
  expect(pulls.cards).toHaveLength(10);
  const pulled = (await pool.query<{ count: number }>('select count(*)::int as count from "gachaPull" where "userId" = $1', [member])).rows[0]!.count;
  expect(pulled).toBe(14);
  // Any ten pulls in a row hold at least one epic or legendary.
  const rows = (await pool.query<{ rarity: string }>('select rarity from "gachaPull" where "userId" = $1 order by "createdAt"', [member])).rows.map(row => row.rarity);
  for (let i = 0; i + 10 <= rows.length; i++) expect(rows.slice(i, i + 10).some(rarity => rarity === 'epic' || rarity === 'legendary')).toBe(true);
  const album = await gacha.getAlbum(member, drinks);
  expect(album.total).toBe(4);
  expect(album.brands[0]).toMatchObject({ brand, total: 4 });
  expect(Object.values(album.byRarity).reduce((a, b) => a + b, 0)).toBe(album.owned);
});

it('pays caps for a can a day, reviews (three a day) and published tier lists, never twice', async () => {
  const id = randomUUID();
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Caps',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `cp_${id.slice(0, 12)}`]);
  try {
    await pool.query(`insert into "drinkLog"("userId", day, name) values ($1, current_date, 'A'), ($1, current_date, 'B')`, [id]);
    for (const flavor of ['a', 'b', 'c', 'd']) await pool.query(
      `insert into review("userId", brand, flavor, design, taste, composition, text) values ($1, $2, $3, 4, 4, 4, 'Отличный энергетик, всем советую')`, [id, brand, flavor]);
    const tier = (await pool.query<{ id: string }>(`insert into "tierList"("userId", slug, title) values ($1, $2, 'T') returning id`, [id, `caps-${id.slice(0, 8)}`])).rows[0]!.id;
    await pool.query(`update "tierList" set status = 'published', "publishedAt" = now() where id = $1`, [tier]);
    await pool.query(`update "tierList" set status = 'draft' where id = $1`, [tier]);
    await pool.query(`update "tierList" set status = 'published' where id = $1`, [tier]);
    expect(await caps(id)).toEqual([{ reason: 'drink-day', amount: 3 }, { reason: 'review', amount: 30 }, { reason: 'tierlist', amount: 15 }]);
  } finally {
    await pool.query('delete from "user" where id = $1', [id]);
  }
});

it('moves cards when two drinks are merged, adding counts and keeping the better rarity', async () => {
  await pool.query(`insert into "gachaCard"("userId", brand, flavor, rarity, count) values ($1, $2, 'old', 'epic', 2), ($1, $2, 'new', 'common', 1)`, [merger, brand]);
  await pool.query('begin');
  try {
    await pool.query('select move_drink_identity($1, $2, $1, $3)', [brand, 'old', 'new']);
    await pool.query('commit');
  } catch (error) { await pool.query('rollback'); throw error; }
  expect((await pool.query('select flavor, rarity, count from "gachaCard" where "userId" = $1', [merger])).rows).toEqual([{ flavor: 'new', rarity: 'epic', count: 3 }]);
});

it('turns duplicates into shards, crafts a missing card once and drops the Halloween frame by its 30th pull', async () => {
  const id = randomUUID();
  await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Season',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `ss_${id.slice(0, 12)}`]);
  try {
    await pool.query(`insert into "capLedger"("userId", reason, "sourceKey", amount) values ($1, 'welcome', 'test-top-up', 900)`, [id]);
    const halloween = Date.parse('2026-10-31T12:00:00+03:00');
    const commons = [drinks[0]!];
    let dropped = false;
    for (let round = 0; round < 3; round++) dropped = Boolean((await gacha.pullGacha(id, 10, commons, halloween)).cosmetic) || dropped;
    expect(dropped).toBe(true);
    const state = await gacha.getGachaState(id, halloween);
    expect(state.banner?.cosmetic?.owned).toBe(true);
    // Thirty pulls of one card: one new, 29 duplicates at 1 shard.
    expect(state.shards).toBe(29);
    expect((await pool.query('select banner from "gachaPull" where "userId" = $1 limit 1', [id])).rows[0]?.banner).toBe('halloween-2026');
    await expect(gacha.craftCard(id, brand, 'rare', drinks)).rejects.toThrow('Не хватает осколков');
    await expect(gacha.craftCard(id, brand, 'epic', drinks)).rejects.toThrow('Не хватает осколков');
    await pool.query(`insert into "shardLedger"("userId", reason, "sourceKey", amount) values ($1, 'dupe', 'test-top-up', 40)`, [id]);
    expect((await gacha.craftCard(id, brand, 'rare', drinks)).shards).toBe(9);
    await expect(gacha.craftCard(id, brand, 'rare', drinks)).rejects.toThrow('уже в альбоме');
    expect((await pool.query('select crafted from "gachaCard" where "userId" = $1 and flavor = $2', [id, 'rare'])).rows[0]?.crafted).toBe(true);
    // Only the owner of the frame can wear it: levels never open it.
    const { canUseProfileAppearance } = await import('../src/lib/profile-appearance');
    expect(canUseProfileAppearance({ theme: 'default', frame: 'pumpkin' }, 1, undefined, ['pumpkin'])).toBe(true);
    expect(canUseProfileAppearance({ theme: 'default', frame: 'pumpkin' }, 20)).toBe(false);
  } finally {
    await pool.query('delete from "user" where id = $1', [id]);
  }
});

it('shows the best epic or legendary pull of the day in the feed, once per member and day', async () => {
  const { getFeed } = await import('../src/lib/profile-community');
  const feed = await getFeed(member, 'following');
  const events = feed.items.filter(item => item.kind === 'gacha');
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: 'gacha', pull: { userId: member, brand } });
});
