import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const trades = await import('../src/lib/card-trades');
const { TRADES_PER_DAY } = await import('../src/lib/card-trade-fields');

const ann = randomUUID(), bob = randomUUID(), eve = randomUUID(), kid = randomUUID(), banned = randomUUID(), foe = randomUUID();
const people = [ann, bob, eve, kid, banned, foe];
const brand = `Обмен ${randomUUID().slice(0, 8)}`;
type R = 'common' | 'rare' | 'epic' | 'legendary';
const drink = (flavor: string, rarity: R) => ({ brand, flavor, name: flavor, cover: `/images/${flavor}.jpg`, href: `/catalog/${flavor}`, rarity });
const drinks = [...['c0', 'c1', 'c2', 'c3'].map(flavor => drink(flavor, 'common')), ...['r0', 'r1', 'r2'].map(flavor => drink(flavor, 'rare')), drink('e0', 'epic'), drink('l0', 'legendary')];
const ref = (flavor: string) => ({ brand, flavor });

async function give(userId: string, flavor: string, rarity: R, count = 1) {
  await pool.query(`insert into "gachaCard"("userId", brand, flavor, rarity, count) values ($1, $2, $3, $4, $5)`, [userId, brand, flavor, rarity, count]);
}
const album = async (userId: string) => Object.fromEntries((await pool.query<{ flavor: string; count: number; locked: boolean }>(
  `select flavor, count, "tradeLockedUntil" > now() as locked from "gachaCard" where "userId" = $1 and brand = $2 order by flavor`, [userId, brand])).rows.map(row => [row.flavor, [row.count, row.locked]]));
const status = async (id: string) => (await pool.query<{ status: string }>('select status from "cardTrade" where id = $1', [id])).rows[0]!.status;

beforeAll(async () => {
  for (const id of people) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Trade test',$2,true,$3,now(),$4)`,
    [id, `${id}@example.com`, id === kid ? new Date() : new Date(Date.now() - 10 * 86_400_000), `tr_${id.slice(0, 8)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
  await pool.query('insert into "memberBlock"("blockerId", "blockedId") values($1, $2)', [foe, ann]);
  await give(ann, 'r0', 'rare');
  await give(ann, 'r1', 'rare');
  await give(ann, 'e0', 'epic');
  await give(bob, 'c0', 'common', 2);
  await give(bob, 'c1', 'common');
  await give(bob, 'c2', 'common');
  await give(bob, 'c3', 'common');
  await give(bob, 'r2', 'rare');
  await give(eve, 'l0', 'legendary');
  await give(eve, 'r2', 'rare');
  for (const id of [kid, banned, foe]) await give(id, 'c0', 'common');
});
afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [people]);
  await pool.end();
});

it('refuses unequal trades, oneself, new, blocked and blocking members', async () => {
  await expect(trades.proposeTrade(ann, bob, [ref('r0')], [ref('c0')], drinks)).rejects.toThrow('почти равным');
  await expect(trades.proposeTrade(bob, ann, [ref('c0')], [ref('e0')], drinks)).rejects.toThrow('почти равным');
  await expect(trades.proposeTrade(ann, ann, [ref('r0')], [ref('r1')], drinks)).rejects.toThrow('Со своей коллекцией');
  await expect(trades.proposeTrade(ann, kid, [ref('r0')], [ref('c0')], drinks)).rejects.toThrow('ещё новый');
  await expect(trades.proposeTrade(kid, ann, [ref('c0')], [ref('r0')], drinks)).rejects.toThrow('после регистрации');
  await expect(trades.proposeTrade(ann, banned, [ref('r0')], [ref('c0')], drinks)).rejects.toThrow('нельзя меняться');
  await expect(trades.proposeTrade(ann, foe, [ref('r0')], [ref('c0')], drinks)).rejects.toThrow('нельзя меняться');
  // Cards one does not have, on either side.
  await expect(trades.proposeTrade(ann, bob, [ref('l0')], [ref('r2')], drinks)).rejects.toThrow('у вас уже нет');
  await expect(trades.proposeTrade(ann, bob, [ref('r0')], [ref('r1')], drinks)).rejects.toThrow('у участника уже нет');
});

it('sends a fair offer, keeps one open offer per pair and notifies the partner', async () => {
  const { id } = await trades.proposeTrade(ann, bob, [ref('r0')], [ref('c0'), ref('c1'), ref('c2')], drinks);
  await expect(trades.proposeTrade(ann, bob, [ref('r1')], [ref('r2')], drinks)).rejects.toThrow('уже предложили');
  await expect(trades.proposeTrade(bob, ann, [ref('r2')], [ref('r1')], drinks)).rejects.toThrow('уже есть предложение');
  const note = await pool.query<{ kind: string; payload: unknown; actorId: string }>(`select kind, payload, "actorId" from notification where "userId" = $1 and kind = 'card-trade'`, [bob]);
  expect(note.rows).toEqual([{ kind: 'card-trade', actorId: ann, payload: { type: 'offer', give: 3, get: 1 } }]);
  expect(await trades.incomingTrades(bob)).toBe(1);
  const desk = await trades.getTradeDesk(bob, ann, drinks);
  expect(desk).toMatchObject({ refusal: null, open: { id, outgoing: false } });
  // Only the partner answers; then the cards change hands at once.
  await expect(trades.answerTrade(ann, id, true, drinks)).rejects.toThrow('Такого предложения нет');
  await trades.answerTrade(bob, id, true, drinks);
  expect(await status(id)).toBe('accepted');
  expect(await album(ann)).toEqual({ c0: [1, true], c1: [1, true], c2: [1, true], e0: [1, null], r1: [1, null] });
  expect(await album(bob)).toEqual({ c0: [1, null], c3: [1, null], r0: [1, true], r2: [1, null] });
  const done = await pool.query<{ payload: { type: string } }>(`select payload from notification where "userId" = $1 and kind = 'card-trade'`, [ann]);
  expect(done.rows.map(row => row.payload.type)).toEqual(['accepted']);
  // Both see the trade from their own side.
  const [forAnn] = await trades.listTrades(ann, drinks);
  expect(forAnn).toMatchObject({ status: 'accepted', outgoing: true, partner: { id: bob } });
  expect(forAnn!.give.map(card => card.flavor)).toEqual(['r0']);
  expect(forAnn!.get.map(card => card.flavor).sort()).toEqual(['c0', 'c1', 'c2']);
  const [forBob] = await trades.listTrades(bob, drinks);
  expect(forBob!.get.map(card => card.flavor)).toEqual(['r0']);
});

it('holds a received card, and the same pair trades once a day', async () => {
  await expect(trades.proposeTrade(ann, bob, [ref('c0')], [ref('c3')], drinks)).rejects.toThrow('недавно получена');
  await expect(trades.proposeTrade(ann, bob, [ref('r1')], [ref('r0')], drinks)).rejects.toThrow('недавно получена');
  const { id } = await trades.proposeTrade(ann, bob, [ref('r1')], [ref('r2')], drinks);
  await expect(trades.answerTrade(bob, id, true, drinks)).rejects.toThrow('сегодня уже был обмен');
  await trades.answerTrade(bob, id, false, drinks);
  expect(await status(id)).toBe('declined');
});

it('checks the cards again on accepting and closes old offers', async () => {
  const { id } = await trades.proposeTrade(ann, eve, [ref('r1')], [ref('r2')], drinks);
  await pool.query('delete from "gachaCard" where "userId" = $1 and brand = $2 and flavor = $3', [ann, brand, 'r1']);
  await expect(trades.answerTrade(eve, id, true, drinks)).rejects.toThrow('у участника уже нет');
  await trades.cancelTrade(ann, id);
  expect(await status(id)).toBe('cancelled');
  await expect(trades.cancelTrade(ann, id)).rejects.toThrow('не действует');

  await give(ann, 'r1', 'rare');
  const late = await trades.proposeTrade(ann, eve, [ref('r1')], [ref('r2')], drinks);
  await pool.query(`update "cardTrade" set "expiresAt" = now() - interval '1 minute' where id = $1`, [late.id]);
  await expect(trades.answerTrade(eve, late.id, true, drinks)).rejects.toThrow('не действует');
  expect((await trades.listTrades(eve, drinks)).find(trade => trade.id === late.id)?.status).toBe('expired');
});

it('stops at the daily number of trades', async () => {
  for (let index = 0; index < TRADES_PER_DAY; index += 1) {
    await pool.query(`insert into "cardTrade"("fromId", "toId", status, "expiresAt", "decidedAt") values ($1, $2, 'accepted', now(), now())`, [eve, index % 2 ? kid : foe]);
  }
  const { id } = await trades.proposeTrade(ann, eve, [ref('r1')], [ref('r2')], drinks);
  await expect(trades.answerTrade(eve, id, true, drinks)).rejects.toThrow(`уже ${TRADES_PER_DAY} обмена`);
});
