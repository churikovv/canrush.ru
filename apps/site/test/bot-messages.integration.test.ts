import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 3 });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const bot = await import('../src/lib/bot-messages');
const { deliverOutbox } = await import('../src/lib/telegram-bot/outbox');

const sent: Array<{ chat_id: string; text: string; parse_mode: string }> = [];
let reply = (_method: string) => Response.json({ ok: true, result: {} });
vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
  const method = String(url).split('/').pop() ?? '';
  if (method === 'sendMessage') sent.push(JSON.parse(String(init.body)));
  return reply(method);
});
vi.stubEnv('TELEGRAM_BOT_TOKEN', `1:${'a'.repeat(35)}`);
vi.stubEnv('TELEGRAM_MINI_APP_URL', 'https://t.me/canrush_test_bot/app');
const deliver = async () => { while (await deliverOutbox(pool, 'test-token', 'https://canrush.ru')) { /* drain */ } };

const member = randomUUID(), silent = randomUUID(), admin = randomUUID();
const telegramId = 800_000_000 + Math.floor(Math.random() * 90_000_000), adminTelegram = telegramId + 1;
const everyone = [member, silent, admin];

beforeAll(async () => {
  for (const id of everyone) await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Bot',$2,true,now(),now(),$3)`,
    [id, `${id}@example.com`, `bm_${id.replaceAll('-', '').slice(0, 12)}`]);
  await pool.query(`insert into "siteAdmin"(email, role) values($1, 'admin')`, [`${admin}@example.com`]);
  for (const [id, chat] of [[member, telegramId], [admin, adminTelegram]] as const) {
    await pool.query(`insert into account(id,"accountId","providerId",issuer,"userId","createdAt","updatedAt") values($1,$2,'telegram','local:telegram',$3,now(),now())`, [randomUUID(), String(chat), id]);
    await pool.query(`insert into "telegramChat"("telegramId","chatId") values($1,$1)`, [chat]);
  }
});

afterAll(async () => {
  await pool.query(`delete from "telegramOutbox" where "chatId" = any($1::bigint[])`, [[telegramId, adminTelegram]]);
  await pool.query(`delete from "adminAuditLog" where "adminEmail" = 'team@example.com'`);
  await pool.query(`delete from "telegramChat" where "telegramId" = any($1::bigint[])`, [[telegramId, adminTelegram]]);
  await pool.query(`delete from "siteAdmin" where email = $1`, [`${admin}@example.com`]);
  await pool.query('delete from "user" where id = any($1::text[])', [everyone]);
  await pool.end();
});

it('queues the team message for a member with the bot and refuses one without it', async () => {
  await expect(bot.sendBotMessage('team@example.com', silent, 'Привет')).rejects.toThrow('не дойдёт');
  await expect(bot.sendBotMessage('team@example.com', member, '   ')).rejects.toThrow('Напишите');
  await bot.sendBotMessage('team@example.com', member, 'Вы выиграли <конкурс>');
  await deliver();
  const message = sent.find(item => String(item.chat_id) === String(telegramId));
  expect(message).toMatchObject({ parse_mode: 'HTML' });
  expect(message?.text).toContain('Вы выиграли &lt;конкурс&gt;');
  expect((await pool.query(`select 1 from "adminAuditLog" where action = 'bot-message' and "targetId" = $1`, [member])).rowCount).toBe(1);
});

it('keeps an answer within a week of the team message and tells the administrators', async () => {
  expect(await bot.recordBotReply(pool, { id: adminTelegram }, 'burn манго')).toBe(false); // nobody wrote to them: a drink search
  expect(await bot.recordBotReply(pool, { id: telegramId, username: 'real_nick' }, 'Спасибо!')).toBe(true);
  const dialogs = await bot.listBotDialogs();
  expect(dialogs.find(item => item.id === member)).toMatchObject({ preview: 'Спасибо!', lastFromTeam: false, unread: 1 });
  const alerts = (await pool.query(`select kind, payload from "telegramOutbox" where "chatId" = $1 and kind = 'direct-reply'`, [adminTelegram])).rows;
  expect(alerts).toMatchObject([{ payload: { userId: member, name: 'Bot (@real_nick)', text: 'Спасибо!' } }]);

  const opened = await bot.getBotDialog(member);
  expect(opened?.messages.map(item => item.fromTeam)).toEqual([true, false]);
  expect(opened?.messages[0]?.failed).toBe(false);
  expect((await bot.listBotDialogs()).find(item => item.id === member)?.unread).toBe(0);

  // Telegram refused it for good: the worker closes the row with the reason, and the dialog says so.
  reply = () => Response.json({ ok: false, error_code: 400, description: 'Bad Request: chat not found' });
  await bot.sendBotMessage('team@example.com', member, 'Ещё одно');
  await deliver();
  reply = () => Response.json({ ok: true, result: {} });
  expect((await bot.getBotDialog(member))?.messages.at(-1)).toMatchObject({ text: 'Ещё одно', failed: true });

  await pool.query(`update "botMessage" set "createdAt" = now() - interval '8 days' where "userId" = $1`, [member]);
  expect(await bot.recordBotReply(pool, { id: telegramId }, 'gorilla')).toBe(false);
});

it('asks Telegram for the real nick and does not guess', async () => {
  expect(await bot.getTelegramNick(silent)).toBeNull();
  reply = () => Response.json({ ok: true, result: { username: 'real_nick' } });
  expect(await bot.getTelegramNick(member)).toEqual({ username: 'real_nick', failed: false });
  reply = () => Response.json({ ok: true, result: {} });
  expect(await bot.getTelegramNick(member)).toEqual({ username: null, failed: false });
  reply = () => Response.json({ ok: true, result: { username: 'x"><script>' } });
  expect(await bot.getTelegramNick(member)).toEqual({ username: null, failed: false });
  reply = () => Response.json({ ok: false, error_code: 403, description: 'Forbidden' });
  expect(await bot.getTelegramNick(member)).toEqual({ username: null, failed: true });
  reply = () => Response.json({ ok: true, result: {} });
});

it('finds a member by nick and goes with the account', async () => {
  const nick = `bm_${member.replaceAll('-', '').slice(0, 12)}`;
  expect((await bot.findBotMembers(nick)).map(item => item.id)).toEqual([member]);
  expect((await bot.findBotMembers(nick))[0]?.reachable).toBe(true);
  await pool.query(`update "telegramChat" set "blockedAt" = now() where "telegramId" = $1`, [telegramId]);
  expect((await bot.findBotMembers(nick))[0]?.reachable).toBe(false);
  await pool.query('delete from "user" where id = $1', [member]);
  expect((await pool.query('select 1 from "botMessage" where "userId" = $1', [member])).rowCount).toBe(0);
});
