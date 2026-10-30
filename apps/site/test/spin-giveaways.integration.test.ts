import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const giveaways = await import('../src/lib/spin-giveaways');
const gacha = await import('../src/lib/gacha');

const [first, second, banned, late] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const members = [first, second, banned, late];
const adminEmail = `${randomUUID()}@example.com`;
const brand = `Раздача ${randomUUID().slice(0, 8)}`;
const drinks = [{ brand, flavor: 'common', name: 'common', cover: '/images/common.jpg', href: '/catalog/common', rarity: 'common' as const }];
const hour = 3_600_000;
const input = (patch = {}) => ({ title: 'Крутки', body: 'За просмотр', spins: 3, viewSeconds: 3, maxClaims: null as number | null, startsAt: new Date(Date.now() - hour), endsAt: new Date(Date.now() + hour), ...patch });
/** The view happened long enough ago: the suite does not wait out the real seconds. */
const age = (id: string, userId: string) => pool.query(`update "spinGiveawayView" set "seenAt" = now() - interval '1 minute' where "giveawayId" = $1 and "userId" = $2`, [id, userId]);
const gifted = async (id: string) => (await gacha.getGachaState(id)).gifted;

beforeAll(async () => {
  for (const id of members) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Giveaway test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `gv_${id.slice(0, 12)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
  // Giveaways left by other runs would stand in front of this suite's banner.
  await pool.query(`update "spinGiveaway" set "endedAt" = now() where "endedAt" is null`);
});
afterAll(async () => {
  await pool.query('delete from "spinGiveaway" where "adminEmail" = $1', [adminEmail]);
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [adminEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [members]);
  await pool.end();
});

it('gives the spins once and only after the view has really lasted', async () => {
  const id = await giveaways.createGiveaway(input(), adminEmail);
  expect((await giveaways.getFeedGiveaway(first))).toMatchObject({ id, spins: 3, taken: false });
  expect((await giveaways.getFeedGiveaway(null))?.id).toBe(id);

  await expect(giveaways.claimGiveaway(id, first)).rejects.toThrow('посмотрите');
  expect(await giveaways.markGiveawaySeen(id, first)).toBeLessThan(1);
  await expect(giveaways.claimGiveaway(id, first)).rejects.toThrow('досматривается');

  await age(id, first);
  expect(await giveaways.markGiveawaySeen(id, first)).toBeGreaterThan(50);
  expect(await giveaways.claimGiveaway(id, first)).toEqual({ spins: 3, balance: 3 });
  expect(await giveaways.claimGiveaway(id, first)).toEqual({ spins: 3, balance: 3 });
  expect(await gifted(first)).toBe(3);

  const row = (await giveaways.listGiveaways()).find(item => item.id === id);
  expect(row).toMatchObject({ claimed: 1, seen: 1 });
  expect((await giveaways.getFeedGiveaway(first))?.taken).toBe(true);
  await pool.query(`update "spinGiveawayView" set "claimedAt" = now() - interval '1 hour' where "giveawayId" = $1`, [id]);
  expect(await giveaways.getFeedGiveaway(first)).toBeNull();
  expect((await giveaways.getFeedGiveaway(second))?.id).toBe(id);
});

it('never hands out more than the limit, even when everyone claims at once', async () => {
  await pool.query(`update "spinGiveaway" set "endedAt" = now() where "endedAt" is null`);
  const id = await giveaways.createGiveaway(input({ spins: 1, maxClaims: 1 }), adminEmail);
  for (const user of [first, second]) { await giveaways.markGiveawaySeen(id, user); await age(id, user); }
  const results = await Promise.allSettled([first, second].map(user => giveaways.claimGiveaway(id, user)));
  expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
  expect((await giveaways.listGiveaways()).find(item => item.id === id)?.claimed).toBe(1);
  expect(await giveaways.getFeedGiveaway(late)).toBeNull();
  expect(await giveaways.markGiveawaySeen(id, late)).toBeNull();
});

it('skips blocked members, and a stopped giveaway ends for everyone', async () => {
  await pool.query(`update "spinGiveaway" set "endedAt" = now() where "endedAt" is null`);
  const id = await giveaways.createGiveaway(input(), adminEmail);
  expect(await giveaways.getFeedGiveaway(banned)).toBeNull();
  await giveaways.markGiveawaySeen(id, banned);
  await age(id, banned);
  await expect(giveaways.claimGiveaway(id, banned)).rejects.toThrow('заблокирован');

  await giveaways.markGiveawaySeen(id, late);
  await age(id, late);
  await giveaways.stopGiveaway(id, adminEmail);
  await expect(giveaways.stopGiveaway(id, adminEmail)).rejects.toThrow('закончилась');
  await expect(giveaways.claimGiveaway(id, late)).rejects.toThrow('закончилась');
  expect(await giveaways.getFeedGiveaway(late)).toBeNull();
  const actions = (await pool.query<{ action: string }>('select action from "adminAuditLog" where "adminEmail" = $1 and "targetId" = $2 order by "createdAt"', [adminEmail, id])).rows.map(row => row.action);
  expect(actions).toEqual(['spin-giveaway', 'spin-giveaway-stop']);
});

it('does not open a giveaway before its start or for a date in the past', async () => {
  await pool.query(`update "spinGiveaway" set "endedAt" = now() where "endedAt" is null`);
  await giveaways.createGiveaway(input({ startsAt: new Date(Date.now() + hour), endsAt: new Date(Date.now() + 2 * hour) }), adminEmail);
  expect(await giveaways.getFeedGiveaway(late)).toBeNull();
  await expect(giveaways.createGiveaway(input({ startsAt: new Date(Date.now() - 2 * hour), endsAt: new Date(Date.now() - hour) }), adminEmail)).rejects.toThrow('прошёл');
});

it('spends a gift after the free pull and before caps; ×10 still costs caps', async () => {
  const before = await gacha.getGachaState(second);
  const spent = await gacha.pullGacha(second, 1, drinks);
  expect(spent.state.free).toBe(false);
  await pool.query(`insert into "spinLedger"("userId", reason, "sourceKey", amount) values ($1, 'giveaway', $2, 2)`, [second, randomUUID()]);
  const stock = (await gacha.getGachaState(second)).gifted;
  const gift = await gacha.pullGacha(second, 1, drinks);
  expect(gift.state).toMatchObject({ gifted: stock - 1, caps: before.caps });
  expect((await gacha.getGachaTeaser(second)).free).toBe(true);
  await gacha.pullGacha(second, 1, drinks);
  expect((await gacha.getGachaState(second)).gifted).toBe(stock - 2);
  await expect(gacha.pullGacha(second, 10, drinks)).rejects.toThrow('Не хватает крышек');
  expect((await gacha.getGachaState(second)).gifted).toBe(stock - 2);
});
