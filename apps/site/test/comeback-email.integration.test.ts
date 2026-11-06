import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
process.env.DATABASE_URL = url;
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET ??= 'comeback-test-secret-of-at-least-32-bytes';
const pool = new Pool({ connectionString: url, max: 4 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
// The catalog is this test's brand only.
const fixture = vi.hoisted(() => {
  const brand = `Письмо ${Math.random().toString(16).slice(2, 10)}`;
  return { brand, options: [{ brand, flavor: 'mango', label: `${brand} · Манго`, cover: '/images/products/mango.jpg' }, { brand, flavor: 'cherry', label: `${brand} · Вишня` }] };
});
vi.mock('@/lib/store-catalog', () => ({ storeDrinkOptions: async () => fixture.options }));
// Its own award key: the award test clears the real award's nominees, and this one's votes must not reach its board.
vi.mock('@/lib/awards-fields', async original => {
  const actual = await original<typeof import('../src/lib/awards-fields')>();
  return { ...actual, AWARD: { ...actual.AWARD, key: 'comeback-test' } };
});
const { runComebackEmails, unsubscribeComeback, comebackSubscribed } = await import('../src/lib/comeback-email');
const { unsubscribeToken } = await import('../src/lib/comeback-email-fields');
const { AWARD, AWARD_CATEGORIES } = await import('../src/lib/awards-fields');
import type { ComebackDigest } from '../src/lib/comeback-email-fields';

const DAY = 86_400_000;
const now = Date.parse('2026-12-01T13:00:00+03:00');
const day = '2026-12-01';
const names = ['away', 'recent', 'optedOut', 'telegram', 'banned', 'unverified', 'maxed', 'lettered', 'voted'] as const;
const ids = Object.fromEntries(names.map(name => [name, randomUUID()])) as Record<(typeof names)[number], string>;
const everyone = Object.values(ids);
const emailOf = (id: string) => id === ids.telegram ? `tg_${id.slice(0, 8)}@12345.telegram.invalid` : `${id}@example.com`;

async function run(options: { now?: number; limit?: number } = {}) {
  const letters: { to: string; digest: ComebackDigest; unsubscribe: string }[] = [];
  const result = await runComebackEmails({ now: options.now ?? now, pauseMs: 0, limit: options.limit ?? 10_000, send: async (to, digest, unsubscribe) => { letters.push({ to, digest, unsubscribe }); } });
  return { result, mine: letters.filter(letter => everyone.some(id => letter.to === emailOf(id))) };
}

beforeAll(async () => {
  for (const name of names) {
    const id = ids[name];
    const seen = name === 'recent' ? now - 3 * DAY : name === 'voted' ? now - 15 * DAY : now - 20 * DAY;
    await pool.query(`insert into "user"(id, name, email, "emailVerified", "createdAt", "updatedAt", username, "lastSeenAt") values ($1, 'Письмо', $2, $3, $4, now(), $5, $6)`,
      [id, emailOf(id), name !== 'unverified', new Date(now - 90 * DAY), `cb_${id.slice(0, 12)}`, new Date(seen)]);
  }
  await pool.query('insert into "userBlock" ("userId") values ($1)', [ids.banned]);
  await pool.query(`insert into "notificationPreference" ("userId", kind, enabled) values ($1, 'comeback-email', false)`, [ids.optedOut]);
  // Three letters since the last visit, the newest 15 days ago: no fourth until the member comes back.
  for (const ago of [19, 17, 15]) await pool.query(`insert into "comebackEmail" ("userId", day, "sentAt") values ($1, $2, $3)`, [ids.maxed, new Date(now - ago * DAY).toISOString().slice(0, 10), new Date(now - ago * DAY)]);
  // A letter five days ago: the next one waits for the gap.
  await pool.query(`insert into "comebackEmail" ("userId", day, "sentAt") values ($1, $2, $3)`, [ids.lettered, new Date(now - 5 * DAY).toISOString().slice(0, 10), new Date(now - 5 * DAY)]);
  // «voted» has voted everywhere and was last here after the new drink: no news, no letter for popular drinks alone.
  for (const category of AWARD_CATEGORIES) {
    await pool.query(`insert into "awardNominee" (award, category, brand, flavor) values ($1, $2, $3, 'mango') on conflict do nothing`, [AWARD.key, category.key, fixture.brand]);
    await pool.query(`insert into "awardVote" (award, category, "userId", brand, flavor) values ($1, $2, $3, $4, 'mango')`, [AWARD.key, category.key, ids.voted, fixture.brand]);
  }
  await pool.query(`insert into notification ("userId","actorId",kind,"eventKey") values ($1,$2,'follow',$3)`, [ids.away, ids.recent, `comeback:${ids.away}`]);
  await pool.query(`insert into "catalogDrink"("ownerId", brand, flavor, volumes, photo, thumbnail, status, "reviewedAt") values ($1, $2, 'mango', '{450}', 'x', 'x', 'published', $3)`, [ids.recent, fixture.brand, new Date(now - 18 * DAY)]);
});

afterAll(async () => {
  await pool.query('delete from "comebackEmail" where day = any($1::date[])', [[day, '2026-12-16']]);
  await pool.query('delete from "awardNominee" where award = $1 and brand = $2', [AWARD.key, fixture.brand]);
  await pool.query('delete from "catalogDrink" where brand = $1', [fixture.brand]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('writes to those away for two weeks, with what is new for them, once a day', async () => {
  const first = await run();
  expect(first.mine.map(letter => letter.to)).toEqual([emailOf(ids.away)]);
  const [letter] = first.mine;
  expect(letter!.digest).toMatchObject({ username: `cb_${ids.away.slice(0, 12)}`, unread: 1, newDrinks: { total: 1, items: [{ brand: fixture.brand, name: 'Манго', cover: 'http://localhost:3000/images/products/mango.jpg' }] } });
  expect(letter!.digest.events.map(event => event.key)).toContain('award');
  expect(letter!.unsubscribe).toBe(`http://localhost:3000/unsubscribe?u=${ids.away}&t=${unsubscribeToken(ids.away, process.env.BETTER_AUTH_SECRET!)}`);
  // The voter has nothing new: the award is done, no notifications, no drinks since the last visit.
  expect(first.result.skipped).toBeGreaterThanOrEqual(1);
  expect((await run()).mine).toEqual([]);
  // Two weeks later: the next letter (news only since the last one, so the drink is not repeated); the gap of «lettered»
  // is over and «recent» is away long enough now. Three letters without a visit stay the limit.
  const later = await run({ now: now + 15 * DAY });
  expect(later.mine.map(item => item.to).sort()).toEqual([ids.away, ids.recent, ids.lettered].map(emailOf).sort());
  expect(later.mine.find(item => item.to === emailOf(ids.away))!.digest.newDrinks.total).toBe(0);
  await pool.query('delete from "comebackEmail" where "userId" = $1 and day <> $2', [ids.away, day]);
});

it('keeps to the daily limit across passes', async () => {
  await pool.query('delete from "comebackEmail" where "userId" = $1', [ids.away]);
  const taken = (await pool.query<{ count: number }>('select count(*)::int as count from "comebackEmail" where day = $1', [day])).rows[0]!.count;
  expect((await run({ limit: taken })).result).toEqual({ sent: 0, failed: 0, skipped: 0 });
});

it('marks a failed letter and does not retry it the same day', async () => {
  await pool.query('delete from "comebackEmail" where "userId" = $1', [ids.away]);
  const failing = await runComebackEmails({ now, pauseMs: 0, limit: 10_000, send: async to => { if (to === emailOf(ids.away)) throw new Error('smtp down'); } });
  expect(failing.failed).toBeGreaterThanOrEqual(1);
  expect((await pool.query('select 1 from "comebackEmail" where "userId" = $1 and day = $2 and "failedAt" is not null', [ids.away, day])).rowCount).toBe(1);
  expect((await run()).mine).toEqual([]);
});

it('unsubscribes by the signed link only', async () => {
  const secret = process.env.BETTER_AUTH_SECRET!;
  expect(await unsubscribeComeback(ids.away, unsubscribeToken(ids.recent, secret))).toBe(false);
  expect(await unsubscribeComeback(ids.away, 'forged')).toBe(false);
  expect(await comebackSubscribed(ids.away)).toBe(true);
  expect(await unsubscribeComeback(ids.away, unsubscribeToken(ids.away, secret))).toBe(true);
  expect(await comebackSubscribed(ids.away)).toBe(false);
  // Nobody to unsubscribe for a made-up id, even with a valid signature.
  const ghost = randomUUID();
  expect(await unsubscribeComeback(ghost, unsubscribeToken(ghost, secret))).toBe(false);
  await pool.query('delete from "comebackEmail" where "userId" = $1', [ids.away]);
  expect((await run()).mine).toEqual([]);
});
