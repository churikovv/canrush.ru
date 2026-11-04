import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const duels = await import('../src/lib/battle-duel');
const { MISSED_LIMIT, TURN_MS } = await import('../src/lib/battle-duel-fields');

const host = randomUUID(), guest = randomUUID(), friend = randomUUID(), stranger = randomUUID(), banned = randomUUID();
const people = [host, guest, friend, stranger, banned];
const brand = `Дуэль ${randomUUID().slice(0, 8)}`;
const drinks = Array.from({ length: 12 }, (_, index) => ({ brand, flavor: `f${index}`, name: `f${index}`, cover: `/images/${index}.jpg`, href: `/catalog/${index}`, rarity: 'common' as const, price: 50 + index * 10 }));
// Числа сезона общие на базу: свой далёкий месяц, убирается за собой.
const NOW = Date.UTC(2091, 2, 10);
const SEASON = '2091-03';

const duelRow = async (code: string) => (await pool.query<{ id: string; status: string; state: { active: 'me' | 'rival' }; winner: string | null; reason: string | null }>('select id, status, state, winner, reason from "battleDuel" where code = $1', [code])).rows[0]!;
/** Who moves now, as a member id. */
const mover = async (code: string) => ((await duelRow(code)).state.active === 'me' ? host : guest);

beforeAll(async () => {
  for (const id of people) await pool.query(
    `insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Duel test',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `dl_${id.slice(0, 8)}`]);
  await pool.query('insert into "userBlock"("userId") values($1)', [banned]);
  // host and friend follow each other; the stranger is only followed by the host.
  await pool.query(`insert into "userFollow"("userId", "targetId") values ($1, $2), ($2, $1), ($1, $3)`, [host, friend, stranger]);
});
afterAll(async () => {
  await pool.query('delete from "battleCardStat" where season = $1', [SEASON]);
  await pool.query('delete from "user" where id = any($1::text[])', [people]);
  await pool.end();
});

it('keeps one open challenge per member and refuses to play oneself', async () => {
  const first = await duels.createDuel(host, NOW);
  expect((await duels.createDuel(host, NOW)).code).toBe(first.code);
  await expect(duels.joinDuel(host, first.code, drinks, NOW)).rejects.toThrow('Это ваш вызов');
  await expect(duels.createDuel(banned, NOW)).rejects.toThrow('заблокирован');
  await duels.cancelDuel(host, first.code);
  expect((await duelRow(first.code)).status).toBe('cancelled');
  await expect(duels.joinDuel(guest, first.code, drinks, NOW)).rejects.toThrow('не действует');
});

it('invites only friends from the site, once per challenge', async () => {
  const { code } = await duels.createDuel(host, NOW);
  await expect(duels.inviteToDuel(host, code, stranger)).rejects.toThrow('только друга');
  await duels.inviteToDuel(host, code, friend);
  await duels.inviteToDuel(host, code, friend);
  const sent = await pool.query<{ kind: string; payload: { code: string } }>(`select kind, payload from notification where "userId" = $1 and kind = 'duel-invite'`, [friend]);
  expect(sent.rows).toEqual([{ kind: 'duel-invite', payload: { code } }]);
  expect((await duels.duelFriends(host)).map(item => [item.id, item.invited])).toEqual([[friend, true]]);
  await duels.cancelDuel(host, code);
});

it('starts the fight on accepting and shows each player their own side', async () => {
  const { code } = await duels.createDuel(host, NOW);
  await duels.joinDuel(guest, code, drinks, NOW);
  const forHost = await duels.getDuelPage(code, host, NOW);
  const forGuest = await duels.getDuelPage(code, guest, NOW);
  const forStranger = await duels.getDuelPage(code, stranger, NOW);
  expect(forHost).toMatchObject({ status: 'active', role: 'host' });
  expect(forGuest).toMatchObject({ status: 'active', role: 'guest' });
  expect(forStranger?.sync).toBeNull();
  const hostView = forHost!.sync!.view, guestView = forGuest!.sync!.view;
  expect(hostView.active).not.toBe(guestView.active);
  expect(hostView.me.health).toBe(guestView.rival.health);
  expect(hostView.hand.map(card => card.uid)).not.toEqual(guestView.hand.map(card => card.uid));
  // Accepting again does nothing; a third member cannot join.
  await duels.joinDuel(guest, code, drinks, NOW);
  await expect(duels.joinDuel(stranger, code, drinks, NOW)).rejects.toThrow('не действует');
  expect(await duels.duelSummary(host)).toMatchObject({ code, status: 'active' });
});

it('lets only the player whose turn it is move, and the rival sees the move', async () => {
  const { code } = (await duels.duelSummary(host))!;
  const { id } = await duelRow(code);
  const active = await mover(code), waiting = active === host ? guest : host;
  const refused = await duels.moveDuel(waiting, id, { kind: 'end' }, 0, NOW + 1000);
  expect(refused.error).toBe('Сейчас ход соперника.');
  const moved = await duels.moveDuel(active, id, { kind: 'end' }, 0, NOW + 1000);
  expect(moved.error).toBeUndefined();
  expect(moved.view.active).toBe('rival');
  const seen = await duels.pollDuel(waiting, id, 0, NOW + 2000);
  expect(seen.view.active).toBe('me');
  expect(seen.frames.at(-1)?.event).toMatchObject({ kind: 'turn', side: 'me' });
  expect(seen.turnEndsAt).toBe(new Date(NOW + 1000 + TURN_MS).toISOString());
});

it(`gives the fight to the one who stayed after ${MISSED_LIMIT} missed turns`, async () => {
  const { code } = (await duels.duelSummary(host))!;
  const { id } = await duelRow(code);
  const late = await mover(code), stayed = late === host ? guest : host;
  // The one who stayed keeps moving on time; the other never comes back.
  let now = NOW + 2000;
  for (let turn = 0; turn < MISSED_LIMIT; turn++) {
    now += TURN_MS + 1000;
    const sync = await duels.pollDuel(stayed, id, 0, now);
    if (sync.result) break;
    await duels.moveDuel(stayed, id, { kind: 'end' }, 0, now + 1);
  }
  const end = await duels.pollDuel(stayed, id, 0, now + TURN_MS + 1000);
  expect(end.result).toEqual({ won: true, reason: 'timeout' });
  expect(await duels.pollDuel(late, id, 0, now + TURN_MS + 2000)).toMatchObject({ result: { won: false, reason: 'timeout' } });
  expect(await duels.duelSummary(host)).toBeNull();
});

it('ends on surrender and calls the same rival to a rematch', async () => {
  const { code } = await duels.createDuel(host, NOW);
  await duels.joinDuel(guest, code, drinks, NOW);
  const { id } = await duelRow(code);
  const sync = await duels.moveDuel(guest, id, { kind: 'surrender' }, 0, NOW + 500);
  expect(sync.result).toEqual({ won: false, reason: 'surrender' });
  expect(await duelRow(code)).toMatchObject({ status: 'finished', winner: 'host', reason: 'surrender' });
  // The guest is no friend of the host's, but a past rival can be called back.
  const again = await duels.rematchDuel(guest, id, NOW);
  const invited = await pool.query(`select 1 from notification where "userId" = $1 and kind = 'duel-invite' and payload->>'code' = $2`, [host, again.code]);
  expect(invited.rowCount).toBe(1);
  await duels.cancelDuel(guest, again.code);
});
