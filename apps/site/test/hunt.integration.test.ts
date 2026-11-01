import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
process.env.BETTER_AUTH_SECRET ??= 'hunt-test-secret-of-at-least-32-bytes-long';
const { claimHunt, createHuntOrder, decideHuntOrder, getHunt, listHuntOrders } = await import('../src/lib/hunt');
const { getNotifications } = await import('../src/lib/notifications');
const { HUNT_TASKS } = await import('../src/lib/hunt-fields');

const member = randomUUID(), other = randomUUID(), blocked = randomUUID();
const everyone = [member, other, blocked];
const stores: string[] = [];
const EVENT = 'hunt-test';
const sbp = { method: 'sbp', phone: '+7 900 123-45-67', bank: 'Т-Банк' };
// Far from every real and test store: each store gets its own spot, so only the tests about distance see a neighbour.
let spot = 0;
const lonely = () => { spot += 1; return { lat: -60 + spot / 2, lng: -170 + spot / 2 }; };
const prices = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `Банка ${index}`, price: 15000, availability: 'available' }));

async function store(owner: string, count: number, options: { photo?: boolean; at?: { lat: number; lng: number }; createdAt?: string } = {}) {
  const { lat, lng } = options.at ?? lonely();
  const id = (await pool.query<{ id: string }>(`insert into "marketStore" ("ownerId", name, city, address, latitude, longitude, "locationSource", catalog, "createdAt") values ($1, 'Тест', 'moscow', $6, $2, $3, 'manual', $4, $5) returning id`,
    [owner, lat, lng, JSON.stringify(prices(count)), options.createdAt ?? '2026-11-10 12:00:00+03', `Адрес ${randomUUID()}`])).rows[0]!.id;
  stores.push(id);
  if (options.photo !== false) await pool.query(`insert into "storePhoto" ("storeId", position, data, thumbnail) values ($1, 0, '\\x00', '\\x00')`, [id]);
  return id;
}
const publish = (id: string) => pool.query(`update "marketStore" set status = 'published' where id = $1`, [id]);
const rewards = async (id: string) => (await pool.query<{ reason: string; amount: number }>('select reason, amount from "huntReward" where "storeId" = $1 order by reason', [id])).rows;
const task = (key: string) => HUNT_TASKS.find(item => item.key === key)!.amount;
const grant = (id: string, amount: number) => pool.query(`insert into "huntLedger" ("userId", reason, "sourceKey", amount) values ($1, 'refund', $2, $3)`, [id, randomUUID(), amount]);

beforeAll(async () => {
  // Своё событие с давним началом: идёт всегда и раньше настоящих, поэтому тест не зависит от календаря.
  await pool.query(`insert into "huntEvent" (key, "startsAt", "endsAt", "reviewUntil", "burnsAt", "memberLimit") values ($1, '2020-01-01', now() + interval '10 days', now() + interval '12 days', now() + interval '400 days', 1000)`, [EVENT]);
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Охотник',$2,true,now(),now(),$3)`, [id, `${id}@example.com`, `hu_${id.replaceAll('-', '').slice(0, 12)}`]);
  await pool.query('insert into "userBlock" ("userId") values ($1)', [blocked]);
});

afterEach(async () => {
  await pool.query('delete from "huntReward" where event = $1', [EVENT]);
  await pool.query('delete from "huntLedger" where "userId" = any($1)', [everyone]);
  await pool.query('delete from "huntOrder" where "userId" = any($1)', [everyone]);
  await pool.query('delete from "marketStore" where id = any($1)', [stores]);
  await pool.query('update "huntEvent" set "memberLimit" = 1000 where key = $1', [EVENT]);
});

afterAll(async () => {
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.query('delete from "huntEvent" where key = $1', [EVENT]);
  await pool.end();
});

it('pays a full new store once, alone or not', async () => {
  const id = await store(member, 6);
  await publish(id);
  expect(await rewards(id)).toEqual([{ reason: 'full', amount: task('full') }]);
  await pool.query(`update "marketStore" set status = 'pending' where id = $1`, [id]);
  await publish(id);
  expect(await rewards(id)).toHaveLength(1);
});

it('does not pay a store without prices, a photo or for a member under a ban', async () => {
  const short = await store(member, 4);
  const bare = await store(member, 6, { photo: false });
  const theirs = await store(blocked, 6);
  await Promise.all([publish(short), publish(bare), publish(theirs)]);
  expect(await rewards(short)).toEqual([]);
  expect(await rewards(bare)).toEqual([]);
  expect(await rewards(theirs)).toEqual([]);
});

it('pays a big assortment, an old store a smaller sum, and nothing for a twin', async () => {
  const big = await store(member, 15);
  await publish(big);
  expect((await rewards(big)).find(row => row.reason === 'big')?.amount).toBe(task('big'));
  const old = await store(member, 6, { createdAt: '2019-10-01 12:00:00+03' });
  await publish(old);
  expect(await rewards(old)).toEqual([{ reason: 'upgrade', amount: task('upgrade') }]);
  const at = lonely();
  const first = await store(member, 6, { at });
  await publish(first);
  const twin = await store(other, 6, { at: { lat: at.lat + 0.0001, lng: at.lng } });
  await publish(twin);
  expect(await rewards(twin)).toEqual([]);
  const near = await store(other, 6, { at: { lat: at.lat + 0.01, lng: at.lng } });
  await publish(near);
  expect(await rewards(near)).toEqual([{ reason: 'full', amount: task('full') }]);
});

it('credits every store on its own and adds the bonus for five stores, once', async () => {
  for (let index = 0; index < 4; index += 1) await publish(await store(member, 6));
  const four = await getHunt(member);
  expect(four.network).toBe(4);
  expect(four.ready).toEqual({ count: 4, amount: 4 * task('full') });
  expect((await claimHunt(member)).amount).toBe(4 * task('full'));
  await publish(await store(member, 6));
  const five = await getHunt(member);
  expect(five.network).toBe(5);
  expect(five.ready).toEqual({ count: 2, amount: task('full') + 10 });
  expect((await claimHunt(member)).amount).toBe(task('full') + 10);
  const after = await getHunt(member);
  expect(after.balance).toBe(5 * task('full') + 10);
  expect(after.levels[0]).toMatchObject({ reached: true, claimed: true });
  expect(after.ready.count).toBe(0);
  await expect(claimHunt(member)).rejects.toThrow('Новых наград');
});

it('caps each member, not the event: the rest of the limit is paid, then nothing, and the others are not touched', async () => {
  await pool.query('update "huntEvent" set "memberLimit" = $2 where key = $1', [EVENT, task('full') + 5]);
  await publish(await store(member, 6));
  expect((await getHunt(member)).limitLeft).toBe(5);
  const partial = await store(member, 6);
  await publish(partial);
  expect(await rewards(partial)).toEqual([{ reason: 'full', amount: 5 }]);
  expect((await getHunt(member)).limitLeft).toBe(0);
  const over = await store(member, 6);
  await publish(over);
  expect(await rewards(over)).toEqual([]);
  const neighbour = await store(other, 6);
  await publish(neighbour);
  expect(await rewards(neighbour)).toEqual([{ reason: 'full', amount: task('full') }]);
  expect((await claimHunt(member)).amount).toBe(task('full') + 5);
  expect((await getHunt(null)).limitLeft).toBe(task('full') + 5);
});

it('does not pass the limit when the same member gets several stores published at once', async () => {
  await pool.query('update "huntEvent" set "memberLimit" = $2 where key = $1', [EVENT, task('full') * 2]);
  const batch = await Promise.all(Array.from({ length: 6 }, () => store(member, 6)));
  await Promise.all(batch.map(publish));
  const total = (await pool.query<{ total: number }>('select coalesce(sum(amount), 0)::int as total from "huntReward" where event = $1 and "userId" = $2', [EVENT, member])).rows[0]!.total;
  expect(total).toBe(task('full') * 2);
});

it('burns the balance and unclaimed rewards after the event, not before', async () => {
  await publish(await store(member, 6));
  await grant(member, 40);
  const burnsAt = Date.parse((await getHunt(member)).event.burnsAt);
  expect((await getHunt(member, burnsAt - 1000)).balance).toBe(40);
  expect((await getHunt(member, burnsAt - 1000)).phase).toBe('exchange');
  await createHuntOrder(member, { item: 'rub', amount: 25, confirmed: true, payout: sbp }, burnsAt - 1000);
  const burnt = await getHunt(member, burnsAt + 1000);
  expect(burnt).toMatchObject({ phase: 'over', balance: 0, ready: { count: 0, amount: 0 } });
  await expect(claimHunt(member, burnsAt + 1000)).rejects.toThrow('сгорели');
  await expect(createHuntOrder(other, { item: 'rub', amount: 1, confirmed: true, payout: sbp }, burnsAt + 1000)).rejects.toThrow('сгорели');
});

it('keeps payout details sealed in the base, opens them for the team and wipes them with the decision', async () => {
  await grant(member, 500);
  await expect(createHuntOrder(member, { item: 'rub', amount: 600, confirmed: true, payout: sbp })).rejects.toThrow('Не хватает');
  await createHuntOrder(member, { item: 'rub', amount: 300, confirmed: true, payout: { method: 'card', number: '4242 4242 4242 4242' } });
  await expect(createHuntOrder(member, { item: 'rub', amount: 100, confirmed: true, payout: sbp })).rejects.toThrow('открытой заявке');
  expect((await getHunt(member)).balance).toBe(200);
  const stored = (await pool.query<{ payout: string }>('select payout from "huntOrder" where "userId" = $1', [member])).rows[0]!.payout;
  expect(stored).not.toContain('4242');
  const order = (await listHuntOrders()).find(row => row.userId === member)!;
  expect(order.payout).toEqual({ method: 'card', number: '4242424242424242' });
  await expect(decideHuntOrder('admin@example.com', order.id, 'cancelled', ' ')).rejects.toThrow('причину');
  await decideHuntOrder('admin@example.com', order.id, 'cancelled', 'Неверный номер');
  expect((await getHunt(member)).balance).toBe(500);
  expect((await pool.query('select payout from "huntOrder" where id = $1', [order.id])).rows[0].payout).toBeNull();
  await expect(decideHuntOrder('admin@example.com', order.id, 'done', '')).rejects.toThrow('уже решена');
  const notice = (await getNotifications(member)).items.find(item => item.kind === 'hunt-order');
  expect(notice).toMatchObject({ title: 'Заявка на обмен отменена', href: '/hunt' });
  await pool.query(`delete from notification where "userId" = $1 and kind = 'hunt-order'`, [member]);
  await pool.query(`delete from "adminAuditLog" where "targetType" = 'hunt-order' and "targetId" = $1`, [order.id]);
});

it('lets a blocked member neither claim nor order', async () => {
  await grant(blocked, 500);
  await expect(claimHunt(blocked)).rejects.toThrow('заблокирован');
  await expect(createHuntOrder(blocked, { item: 'rub', amount: 300, confirmed: true, payout: sbp })).rejects.toThrow('заблокирован');
});
