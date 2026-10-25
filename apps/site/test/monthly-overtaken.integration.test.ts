import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(databaseUrl).pathname !== '/canrush_site_test') throw new Error('Only canrush_site_test is allowed');
const pool = new Pool({ connectionString: databaseUrl, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const { getNotifications } = await import('../src/lib/notifications');
const { renderOutboxMessage } = await import('../src/lib/telegram-bot/outbox');

// The trigger follows the current Moscow month, so these members race now with totals far above any other test data:
// they hold the whole top five between them.
const BASE = 10_000_000;
const ids = Array.from({ length: 7 }, () => randomUUID());
const [first, second, third, fourth, fifth, sixth, chaser] = ids as [string, string, string, string, string, string, string];
const username = (id: string) => `ovt_${id.replaceAll('-', '').slice(0, 12)}`;
let key = 0;
// Fifth has Telegram linked and the bot started, so its site notifications are mirrored to the bot's queue.
const telegramId = String(9_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
const gain = (id: string, points: number) =>
  pool.query(`insert into "profileExperience" ("userId", reason, "sourceKey", points) values ($1, 'review', $2, $3)`, [id, `overtaken-test-${key++}`, points]);
const overtaken = async (id: string) => (await pool.query<{ actorId: string; payload: { place: number; gap: number } }>(
  `select "actorId", payload from notification where "userId" = $1 and kind = 'overtaken' order by "createdAt"`, [id])).rows;

beforeAll(async () => {
  for (const id of ids) await pool.query(`insert into "user" (id, name, username, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Overtake test', $2, $3, true, now(), now())`, [id, username(id), `${id}@example.com`]);
  // Places 1–6 by 100 XP steps; the chaser starts below them all.
  for (const [index, id] of [first, second, third, fourth, fifth, sixth].entries()) await gain(id, BASE + (6 - index) * 100);
  await gain(chaser, BASE);
  await pool.query(`insert into account (id, issuer, "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, 'local:telegram', $2, 'telegram', $3, now(), now())`, [randomUUID(), telegramId, fifth]);
  await pool.query(`insert into "telegramChat" ("telegramId", "chatId") values ($1, $1)`, [telegramId]);
});
afterAll(async () => {
  await pool.query('delete from "telegramOutbox" where "chatId" = $1', [telegramId]);
  await pool.query('delete from "telegramChat" where "telegramId" = $1', [telegramId]);
  await pool.query('delete from "user" where id = any($1::text[])', [ids]);
  await pool.end();
});

it('tells the members of the month top five that someone passed them, with the new place and the gap', async () => {
  // Totals above BASE: first 600, second 500, third 400, fourth 300, fifth 200, sixth 100, chaser 0.
  // +250 passes fifth and sixth, not fourth.
  await gain(chaser, 250);
  expect(await overtaken(fifth)).toEqual([{ actorId: chaser, payload: expect.objectContaining({ place: 6, gap: 50 }) }]);
  // Sixth was outside the top five, so it is not told.
  expect(await overtaken(sixth)).toEqual([]);
  expect(await overtaken(fourth)).toEqual([]);
  const { items } = await getNotifications(fifth);
  expect(items[0]).toMatchObject({ kind: 'overtaken', title: `@${username(chaser)} обогнал вас в топе месяца`, detail: 'Теперь вы на 6 месте · отставание 50 XP', href: '/leaderboard' });
  // The Telegram bot gets the same notification through notification_telegram, rendered with an «Открыть» button.
  const queued = (await pool.query<{ kind: 'notification'; payload: Record<string, unknown> }>(`select kind, payload from "telegramOutbox" where "chatId" = $1`, [telegramId])).rows;
  expect(queued).toHaveLength(1);
  const message = await renderOutboxMessage(queued[0]!, 'https://canrush.ru');
  expect(message?.text).toBe(`🔔 <b>@${username(chaser)} обогнал вас в топе месяца</b>\nТеперь вы на 6 месте · отставание 50 XP`);
  expect(JSON.stringify(message?.keyboard)).toContain('https://canrush.ru/leaderboard');
});

it('does not repeat for the same pair on the same day, and skips members who switched it off', async () => {
  // Fourth turns these notifications off; fifth takes its place back (300 against the chaser's 250).
  await pool.query(`insert into "notificationPreference" ("userId", kind, enabled) values ($1, 'overtaken', false)`, [fourth]);
  await gain(fifth, 100);
  // The chaser passes fourth and fifth again the same day: fifth is not told twice, fourth not at all.
  await gain(chaser, 100);
  expect(await overtaken(fifth)).toHaveLength(1);
  expect(await overtaken(fourth)).toEqual([]);
  // Third (400) is passed next and is told it is now fourth.
  await gain(chaser, 100);
  expect(await overtaken(third)).toEqual([{ actorId: chaser, payload: expect.objectContaining({ place: 4, gap: 50 }) }]);
});
