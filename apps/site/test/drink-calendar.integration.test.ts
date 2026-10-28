import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 3, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
vi.mock('../src/lib/store-catalog', () => ({ storeDrinkOptions: async () => [{ brand: 'Burn', flavor: 'original', label: 'Burn · Оригинальный', cover: '/images/burn.jpg' }] }));
const calendar = await import('../src/lib/drink-calendar');
const { addDays } = await import('../src/lib/drink-calendar-fields');

const owner = randomUUID();
const start = '2031-03-01';
const drink = (day: string, extra: Partial<{ brand: string; flavor: string; price: number; store: string }> = {}) =>
  ({ day, name: 'Свой напиток', price: extra.price ?? null, store: extra.store ?? null, ...(extra.brand ? { brand: extra.brand, flavor: extra.flavor! } : {}) });
const xp = async (reason: string) => (await pool.query<{ key: string; points: number }>('select "sourceKey" as key, points from "profileExperience" where "userId" = $1 and reason = $2 order by "sourceKey"', [owner, reason])).rows;

beforeAll(async () => {
  await pool.query(`insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt") values ($1, 'Calendar test', $2, true, $3, now(), now())`, [owner, `${owner}@example.com`, `test_${owner.replaceAll('-', '').slice(0, 16)}`]);
});
afterAll(async () => { await pool.query('delete from "user" where id = $1', [owner]); await pool.end(); });

describe.sequential('drink calendar storage', () => {
  it('links catalog drinks on the server and keeps private notes from other viewers', async () => {
    // The first can pays the day XP and the "first sip" tag with its own XP, and reports both for the celebration card.
    expect(await calendar.addDrink(owner, drink(start, { brand: 'Burn', flavor: 'original', price: 12990, store: 'Магнит' }), start)).toEqual({ streak: 1, xp: 30, tags: ['drink-start'] });
    expect(await calendar.addDrink(owner, drink(start, { brand: 'Fake', flavor: 'nope' }), start)).toEqual({ streak: 1, xp: 0, tags: [] });
    const own = await calendar.getDrinkEntries(owner, start, start, true, true);
    expect(own.map(entry => [entry.name, entry.brand, entry.price, entry.store])).toEqual([['Burn · Оригинальный', 'Burn', 12990, 'Магнит'], ['Свой напиток', null, null, null]]);
    expect(own[0]!.href).toMatch(/^\/catalog\/burn/);
    const visitor = await calendar.getDrinkEntries(owner, start, start, false);
    expect(visitor[0]).toMatchObject({ price: null, store: null });
    expect(await calendar.getRecentDrinkStores(owner)).toEqual(['Магнит']);
  });
  it('pays day XP once per day and milestone bonuses once per streak, then grants calendar tags', async () => {
    for (let index = 1; index < 7; index++) await calendar.addDrink(owner, drink(addDays(start, index)), addDays(start, index));
    const overview = await calendar.getDrinkOverview(owner, addDays(start, 6));
    expect(overview).toMatchObject({ total: 8, best: 7, current: { start, length: 7 } });
    expect(await xp('drink-day')).toHaveLength(7);
    expect(await xp('drink-streak')).toEqual([{ key: `${start}:3`, points: 30 }, { key: `${start}:7`, points: 70 }]);
    const earned = (await pool.query<{ key: string }>('select key from "profileAchievement" where "userId" = $1 order by key', [owner])).rows.map(row => row.key);
    expect(earned).toEqual(expect.arrayContaining(['drink-start', 'streak-7']));
    expect((await pool.query('select 1 from "profileExperience" where "userId" = $1 and reason = $2 and "sourceKey" = $3', [owner, 'achievement', 'streak-7'])).rowCount).toBe(1);
  });
  it('limits cans per day and edits to today or yesterday without paying twice', async () => {
    const today = addDays(start, 6);
    for (let index = 1; index < 10; index++) await calendar.addDrink(owner, drink(today), today);
    await expect(calendar.addDrink(owner, drink(today), today)).rejects.toThrow('не больше 10');
    const [old] = await calendar.getDrinkEntries(owner, start, start, true);
    await expect(calendar.deleteDrink(owner, old!.id, today)).rejects.toThrow('сегодня и вчера');
    const [recent] = await calendar.getDrinkEntries(owner, today, today, true);
    await expect(calendar.deleteDrink(randomUUID(), recent!.id, today)).rejects.toThrow();
    await calendar.deleteDrink(owner, recent!.id, today);
    await calendar.addDrink(owner, drink(today), today);
    expect(await xp('drink-day')).toHaveLength(7);
    expect(await xp('drink-streak')).toHaveLength(2);
  });

  it('restores one forgotten day: the runs join, milestones pay once, no can, once per 15 days', async () => {
    const other = randomUUID();
    await pool.query(`insert into "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt") values ($1, 'Restore test', $2, true, $3, now(), now())`, [other, `${other}@example.com`, `test_${other.replaceAll('-', '').slice(0, 16)}`]);
    try {
      const from = '2032-05-01';
      for (const shift of [0, 1, 2, 3, 5, 6]) await calendar.addDrink(other, drink(addDays(from, shift)), addDays(from, shift));
      const today = addDays(from, 6);
      expect((await calendar.getDrinkOverview(other, today)).restore).toEqual({ day: addDays(from, 4), length: 7 });
      expect(await calendar.restoreStreak(other, today)).toEqual({ length: 7, xp: 70, day: addDays(from, 4) });
      const overview = await calendar.getDrinkOverview(other, today);
      expect(overview).toMatchObject({ total: 6, current: { start: from, length: 7 }, restored: [addDays(from, 4)], restore: null });
      expect(overview.dayCounts[addDays(from, 4)]).toBeUndefined();
      const paid = (await pool.query<{ key: string }>(`select "sourceKey" as key from "profileExperience" where "userId" = $1 and reason = 'drink-streak' order by 1`, [other])).rows.map(row => row.key);
      expect(paid).toEqual([`${from}:3`, `${from}:7`]);
      // The 7 tag counts restored days too.
      expect((await pool.query('select 1 from "profileAchievement" where "userId" = $1 and key = $2', [other, 'streak-7'])).rowCount).toBe(1);
      await expect(calendar.restoreStreak(other, today)).rejects.toThrow('вернуть нечего');
      // Another gap within 15 days of the restore: not yet.
      await pool.query(`update "drinkStreakRestore" set "createdAt" = $2::date where "userId" = $1`, [other, today]);
      await calendar.addDrink(other, drink(addDays(from, 8)), addDays(from, 8));
      expect((await calendar.getDrinkOverview(other, addDays(from, 8))).restore).toEqual({ availableOn: addDays(today, 15) });
      await expect(calendar.restoreStreak(other, addDays(from, 8))).rejects.toThrow('раз в 15 дней');
    } finally { await pool.query('delete from "user" where id = $1', [other]); }
  });
});
