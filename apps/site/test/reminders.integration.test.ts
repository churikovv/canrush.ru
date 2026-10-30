import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(DATABASE_URL).pathname !== '/canrush_site_test') throw new Error('Only test database allowed');
process.env.DATABASE_URL = DATABASE_URL;
process.env.BETTER_AUTH_URL = 'https://canrush.test';
process.env.BETTER_AUTH_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';

const { getPool } = await import('../src/db/pool.js');
const { addDays } = await import('../src/lib/drink-calendar-fields.js');
const { queueGachaReminders, queueStreakReminders } = await import('../src/lib/reminders.js');
const { runDueJobs } = await import('../src/lib/telegram-bot/jobs.js');
const { deliverOutbox } = await import('../src/lib/telegram-bot/outbox.js');
const { deliverPush, registerPushDevice } = await import('../src/lib/push/outbox.js');

const pool = getPool();
const site = 'https://canrush.test';
// A day of its own: reminders and job claims of this suite never meet real ones.
const TODAY = '2031-03-12';
const EVENING = new Date('2031-03-12T15:30:00Z');
const members: string[] = [];
const chats: number[] = [];
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pushEnv = { fcm: { projectId: 'canrush-test', clientEmail: 'push@canrush-test.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }, rustore: null, apns: null };
const telegram: { method: string; body: Record<string, unknown> }[] = [];
const pushes: { message: { token: string; data: { url: string }; notification: { title: string; body: string } } }[] = [];

vi.stubGlobal('fetch', async (input: string, init: RequestInit) => {
  if (input === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'access', expires_in: 3600 });
  if (String(input).startsWith('https://fcm.googleapis.com/')) {
    pushes.push(JSON.parse(String(init.body)));
    return Response.json({ name: 'ok' });
  }
  telegram.push({ method: String(input).split('/').pop() ?? '', body: JSON.parse(String(init.body)) });
  return Response.json({ ok: true, result: {} });
});

async function member(): Promise<string> {
  const id = randomUUID();
  members.push(id);
  await pool.query('insert into "user" (id, name, email, username, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, $4, true, now(), now())',
    [id, 'Напоминание', `${id}@example.com`, `r${id.slice(0, 8)}`]);
  return id;
}

/** One can on each day, counted back from TODAY (0 = today). */
async function logDays(userId: string, ...back: number[]) {
  for (const days of back) await pool.query(`insert into "drinkLog" ("userId", day, name) values ($1, $2::date, 'Банка')`, [userId, addDays(TODAY, -days)]);
}
// The machine's rows are dated by hand: the count of silent days runs from them, and this suite lives in its own year.
const noon = (day: string) => `${day}T12:00:00+03:00`;
const openMachine = (userId: string, day = TODAY) => pool.query(`insert into "capLedger" ("userId", reason, "sourceKey", amount, "createdAt")
  values ($1, 'welcome', 'welcome', 30, $2)`, [userId, noon(day)]);
const pull = (userId: string, day: string, free: boolean) => pool.query(`insert into "gachaPull" ("userId", batch, brand, flavor, rarity, "freeDay", "createdAt")
  values ($1, gen_random_uuid(), 'Burn', 'original', 'common', case when $3 then $2::date end, $4)`, [userId, day, free, noon(day)]);
const takeFreePull = (userId: string, day = TODAY) => pull(userId, day, true);

async function linkTelegram(userId: string): Promise<number> {
  const chat = 8_100_000_000 + Math.floor(Math.random() * 90_000_000);
  chats.push(chat);
  await pool.query(`insert into account (id, issuer, "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, 'local:telegram', $2, 'telegram', $3, now(), now())`, [`acc-${userId}`, String(chat), userId]);
  await pool.query('insert into "telegramChat" ("telegramId", "chatId") values ($1, $1)', [chat]);
  return chat;
}

async function reminders(userId: string) {
  return (await pool.query<{ eventKey: string; payload: Record<string, unknown> }>(`select "eventKey", payload from notification where "userId" = $1 and kind = 'reminder' order by "createdAt"`, [userId])).rows;
}
const expectStreak = (length: number) => [{ eventKey: `reminder:${TODAY}`, payload: { type: 'streak', length } }];
const GACHA = [{ eventKey: `reminder:${TODAY}`, payload: { type: 'gacha' } }];

async function drainTelegram() { while (await deliverOutbox(pool, '1:test', site)) { /* drain */ } }
async function drainPush() { while (await deliverPush(pool, pushEnv, site)) { /* drain */ } }
const sentTo = (chat: number) => telegram.find(call => call.method === 'sendMessage' && String(call.body.chat_id) === String(chat));

const clearClaims = () => pool.query('delete from "telegramJobRun" where period = any($1::text[])', [[TODAY, addDays(TODAY, 1)]]);

beforeAll(clearClaims);
beforeEach(() => { telegram.length = 0; pushes.length = 0; });
afterAll(async () => {
  await clearClaims();
  await pool.query('delete from "telegramOutbox" where "chatId" = any($1::bigint[])', [chats]);
  await pool.query('delete from "telegramChat" where "telegramId" = any($1::bigint[])', [chats]);
  await pool.query('delete from "user" where id = any($1::text[])', [members]);
  await pool.end();
});

describe.sequential('Streak reminder', () => {
  it('reaches the bell, Telegram and push once, and speaks only about marking', async () => {
    const id = await member();
    await logDays(id, 1, 2, 3, 4, 5);
    const chat = await linkTelegram(id);
    const token = `fcm-reminder-${randomUUID()}`;
    await registerPushDevice(pool, id, token, 'fcm');

    await queueStreakReminders(pool, TODAY);
    expect(await reminders(id)).toEqual(expectStreak(5));

    await drainTelegram();
    await drainPush();
    const message = sentTo(chat);
    expect(String(message?.body.text)).toContain('Серия 5 дней: не забудьте отметить');
    expect(String(message?.body.text)).toContain('Если сегодня была банка');
    expect(String(message?.body.text)).not.toMatch(/выпе|выпи|попе|наград|бонус|XP/iu);
    expect(JSON.stringify(message?.body.reply_markup)).toContain(`${site}/calendar`);
    expect(pushes.filter(push => push.message.token === token)).toEqual([expect.objectContaining({
      message: expect.objectContaining({ data: expect.objectContaining({ url: '/calendar' }), notification: expect.objectContaining({ title: 'Серия 5 дней: не забудьте отметить' }) }),
    })]);
  });

  it('counts a day brought back with «Вернуть огонёк»', async () => {
    const id = await member();
    await logDays(id, 1, 3, 4);
    await pool.query('insert into "drinkStreakRestore" ("userId", day) values ($1, $2::date)', [id, addDays(TODAY, -2)]);
    await queueStreakReminders(pool, TODAY);
    expect(await reminders(id)).toEqual(expectStreak(4));
  });

  it('starts at three days and skips a marked today or a streak already gone', async () => {
    const [three, two, marked, gone, broken] = [await member(), await member(), await member(), await member(), await member()];
    await logDays(three, 1, 2, 3);
    await logDays(two, 1, 2);
    await logDays(marked, 0, 1, 2, 3);
    await logDays(gone, 2, 3, 4, 5);
    await logDays(broken, 1, 3, 4, 5);
    await queueStreakReminders(pool, TODAY);
    expect(await reminders(three)).toEqual(expectStreak(3));
    for (const id of [two, marked, gone, broken]) expect(await reminders(id)).toEqual([]);
  });
});

describe.sequential('Free pull reminder', () => {
  it('reaches a member who opened the machine and has not taken today’s pull', async () => {
    const id = await member();
    await openMachine(id);
    await takeFreePull(id, addDays(TODAY, -1));
    const chat = await linkTelegram(id);
    await queueGachaReminders(pool, TODAY);
    expect(await reminders(id)).toEqual(GACHA);

    await drainTelegram();
    const message = sentTo(chat);
    expect(String(message?.body.text)).toContain('Бесплатная крутка ждёт');
    expect(JSON.stringify(message?.body.reply_markup)).toContain(`${site}/gacha`);
  });

  it('skips a member who took it, or never opened the machine', async () => {
    const [took, never] = [await member(), await member()];
    await openMachine(took);
    await takeFreePull(took);
    await queueGachaReminders(pool, TODAY);
    expect(await reminders(took)).toEqual([]);
    expect(await reminders(never)).toEqual([]);
  });

  it('gives way to a streak at risk, which is told in the evening instead', async () => {
    const [risk, marked, short] = [await member(), await member(), await member()];
    for (const id of [risk, marked, short]) await openMachine(id);
    await logDays(risk, 1, 2, 3);
    await logDays(marked, 0, 1, 2);
    await logDays(short, 1, 2);

    await queueGachaReminders(pool, TODAY);
    expect(await reminders(risk)).toEqual([]);
    expect(await reminders(marked)).toEqual(GACHA);
    expect(await reminders(short)).toEqual(GACHA);

    await queueStreakReminders(pool, TODAY);
    expect(await reminders(risk)).toEqual(expectStreak(3));
    expect(await reminders(marked)).toEqual(GACHA);
  });

  it('goes quiet after a week without a pull, whatever the member does elsewhere on the site', async () => {
    const [opened, silent, pulled, stopped, paid, reader] = [await member(), await member(), await member(), await member(), await member(), await member()];
    await openMachine(opened, addDays(TODAY, -7));
    await openMachine(silent, addDays(TODAY, -8));
    await openMachine(pulled, addDays(TODAY, -30));
    await takeFreePull(pulled, addDays(TODAY, -3));
    await openMachine(stopped, addDays(TODAY, -30));
    await takeFreePull(stopped, addDays(TODAY, -8));
    await openMachine(paid, addDays(TODAY, -30));
    await pull(paid, addDays(TODAY, -2), false);
    await openMachine(reader, addDays(TODAY, -8));
    await pool.query(`update "user" set "lastSeenAt" = $2 where id = $1`, [reader, noon(TODAY)]);

    await queueGachaReminders(pool, TODAY);
    for (const id of [opened, pulled, paid]) expect(await reminders(id)).toEqual(GACHA);
    for (const id of [silent, stopped, reader]) expect(await reminders(id)).toEqual([]);
  });

  it('removes the last reminder of a member who went quiet and speaks again after the next pull', async () => {
    const id = await member();
    await openMachine(id, addDays(TODAY, -8));
    await queueGachaReminders(pool, addDays(TODAY, -1));
    expect(await reminders(id)).toHaveLength(1);

    await queueGachaReminders(pool, TODAY);
    expect(await reminders(id)).toEqual([]);

    await takeFreePull(id, addDays(TODAY, -1));
    await queueGachaReminders(pool, TODAY);
    expect(await reminders(id)).toEqual(GACHA);
  });
});

describe.sequential('Who gets none, and how many', () => {
  it('sends nothing to a member who turned reminders off, and nothing to Telegram or push either', async () => {
    const [streak, gacha] = [await member(), await member()];
    await logDays(streak, 1, 2, 3);
    await openMachine(gacha);
    const chat = await linkTelegram(streak);
    const token = `fcm-reminder-${randomUUID()}`;
    await registerPushDevice(pool, streak, token, 'fcm');
    for (const id of [streak, gacha]) await pool.query(`insert into "notificationPreference" ("userId", kind, enabled) values ($1, 'reminder', false)`, [id]);

    await queueStreakReminders(pool, TODAY);
    await queueGachaReminders(pool, TODAY);
    expect(await reminders(streak)).toEqual([]);
    expect(await reminders(gacha)).toEqual([]);
    expect((await pool.query('select 1 from "telegramOutbox" where "chatId" = $1', [chat])).rowCount).toBe(0);
    expect((await pool.query('select 1 from "pushOutbox" where token = $1', [token])).rowCount).toBe(0);
  });

  it('skips banned and frozen members, and a freeze that has passed no longer counts', async () => {
    const [banned, frozen, thawed, bannedPull, frozenPull] = [await member(), await member(), await member(), await member(), await member()];
    for (const id of [banned, frozen, thawed]) await logDays(id, 1, 2, 3);
    for (const id of [bannedPull, frozenPull]) await openMachine(id);
    for (const id of [banned, bannedPull]) await pool.query('insert into "userBlock" ("userId") values ($1)', [id]);
    for (const id of [frozen, frozenPull]) await pool.query(`insert into "userFreeze" ("userId", until) values ($1, now() + interval '1 day')`, [id]);
    await pool.query(`insert into "userFreeze" ("userId", until) values ($1, now() - interval '1 minute')`, [thawed]);

    await queueGachaReminders(pool, TODAY);
    await queueStreakReminders(pool, TODAY);
    for (const id of [banned, frozen, bannedPull, frozenPull]) expect(await reminders(id)).toEqual([]);
    expect(await reminders(thawed)).toEqual(expectStreak(3));
  });

  it('holds one reminder of either type a day through repeated runs', async () => {
    const [streak, gacha] = [await member(), await member()];
    await logDays(streak, 1, 2, 3);
    await openMachine(gacha);
    for (let run = 0; run < 2; run += 1) {
      await queueGachaReminders(pool, TODAY);
      await queueStreakReminders(pool, TODAY);
    }
    expect(await reminders(streak)).toEqual(expectStreak(3));
    expect(await reminders(gacha)).toEqual(GACHA);

    // A streak filled in after the daytime message: the day's one reminder is already spent.
    await logDays(gacha, 1, 2, 3);
    await queueStreakReminders(pool, TODAY);
    expect(await reminders(gacha)).toEqual(GACHA);
  });

  it('replaces yesterday’s reminder, so a member who is away does not collect them', async () => {
    const id = await member();
    await openMachine(id);
    await queueGachaReminders(pool, addDays(TODAY, -1));
    await queueGachaReminders(pool, TODAY);
    expect(await reminders(id)).toEqual(GACHA);
  });
});

describe.sequential('Schedule', () => {
  it('claims the day once across runs, and a failed run gives its claim back', async () => {
    const id = await member();
    await logDays(id, 1, 2, 3);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = {
      query: (sql: string, values?: unknown[]) => (sql.includes('insert into notification') ? Promise.reject(new Error('down')) : pool.query(sql, values)),
      connect: () => pool.connect(),
    } as unknown as Pool;

    await runDueJobs(failing, EVENING);
    expect(await reminders(id)).toEqual([]);
    expect(error).toHaveBeenCalledWith('Telegram job streak-reminder failed', 'down');
    expect((await pool.query(`select 1 from "telegramJobRun" where job = 'streak-reminder' and period = $1`, [TODAY])).rowCount).toBe(0);
    error.mockRestore();

    await runDueJobs(pool, EVENING);
    expect(await reminders(id)).toEqual(expectStreak(3));
    expect((await pool.query(`select 1 from "telegramJobRun" where job = 'streak-reminder' and period = $1`, [TODAY])).rowCount).toBe(1);

    await pool.query(`delete from notification where "userId" = $1 and kind = 'reminder'`, [id]);
    await runDueJobs(pool, EVENING);
    expect(await reminders(id)).toEqual([]);
  });
});
