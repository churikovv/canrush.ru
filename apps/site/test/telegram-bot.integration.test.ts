import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
process.env.DATABASE_URL = DATABASE_URL;
process.env.BETTER_AUTH_URL = 'https://canrush.test';
process.env.BETTER_AUTH_SECRET = 'canrush-integration-test-secret-32-bytes-minimum';

const { getPool } = await import('../src/db/pool.js');
const { handleTelegramUpdate } = await import('../src/lib/telegram-bot/updates.js');
const { deliverOutbox, enqueueTelegram } = await import('../src/lib/telegram-bot/outbox.js');

const pool = getPool();
const runId = randomUUID().replaceAll('-', '').slice(0, 10);
const telegramId = 8_000_000_000 + Number.parseInt(runId.slice(0, 7), 16);
const ctx = { pool, token: '1:test', siteUrl: 'https://canrush.test', botUsername: 'canrush_test_bot' };
const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
let reply: (method: string) => Response = () => Response.json({ ok: true, result: {} });

vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
  const method = String(url).split('/').pop() ?? '';
  calls.push({ method, body: JSON.parse(String(init.body)) });
  return reply(method);
});

const userId = `tg-bot-${runId}`;
const actorId = `tg-actor-${runId}`;

beforeEach(() => {
  calls.length = 0;
  reply = () => Response.json({ ok: true, result: {} });
});

afterAll(async () => {
  await pool.query('delete from "telegramOutbox" where "chatId" = $1', [telegramId]);
  await pool.query('delete from "telegramChat" where "telegramId" = $1', [telegramId]);
  await pool.query('delete from "user" where id = any($1::text[])', [[userId, actorId]]);
  await pool.end();
});

async function outbox() {
  return (await pool.query<{ kind: string; sentAt: Date | null; lastError: string | null }>('select kind, "sentAt", "lastError" from "telegramOutbox" where "chatId" = $1 order by id', [telegramId])).rows;
}

async function deliverOwn() {
  // Other suites never start Telegram chats, so every due row belongs to this run.
  while (await deliverOutbox(pool, ctx.token, ctx.siteUrl)) { /* drain */ }
}

describe.sequential('Telegram bot', () => {
  it('registers the chat on /start and asks for a city', async () => {
    await handleTelegramUpdate(ctx, { update_id: 1, message: { message_id: 1, chat: { id: telegramId, type: 'private' }, from: { id: telegramId }, text: '/start' } });
    expect((await pool.query('select 1 from "telegramChat" where "telegramId" = $1', [telegramId])).rowCount).toBe(1);
    expect(calls.map(call => call.method)).toEqual(['sendMessage', 'sendMessage']);
    expect(String(calls[0]?.body.text)).toContain('бот CanRush');
    expect(JSON.stringify(calls[1]?.body.reply_markup)).toContain('c:moscow');
  });

  it('answers a search with nothing found for nonsense', async () => {
    await handleTelegramUpdate(ctx, { update_id: 2, message: { message_id: 2, chat: { id: telegramId, type: 'private' }, from: { id: telegramId }, text: 'zzqqxxvv' } });
    expect(String(calls[0]?.body.text)).toContain('Ничего не нашёл');
  });

  it('mirrors site notifications of a linked member and respects the switch', async () => {
    await pool.query(`insert into "user" (id, name, email, "emailVerified", username) values ($1, 'Bot', $2, true, $3), ($4, 'Actor', $5, true, $6)`,
      [userId, `${userId}@example.com`, `b${runId}`, actorId, `${actorId}@example.com`, `a${runId}`]);
    await pool.query(`insert into account (id, issuer, "accountId", "providerId", "userId", "createdAt", "updatedAt") values ($1, 'local:telegram', $2, 'telegram', $3, now(), now())`,
      [`acc-${runId}`, String(telegramId), userId]);

    await pool.query(`insert into notification ("userId", "actorId", kind, "eventKey") values ($1, $2, 'follow', $3)`, [userId, actorId, `follow:${runId}:1`]);
    expect((await outbox()).map(row => row.kind)).toEqual(['notification']);

    await deliverOwn();
    const sent = calls.find(call => call.method === 'sendMessage');
    expect(String(sent?.body.text)).toContain(`@a${runId} подписался на вас`);
    expect(JSON.stringify(sent?.body.reply_markup)).toContain(`https://canrush.test/profile/a${runId}`);
    expect((await outbox())[0]?.sentAt).not.toBeNull();

    await handleTelegramUpdate(ctx, { update_id: 3, callback_query: { id: 'cb', from: { id: telegramId }, data: 't:n', message: { message_id: 5, chat: { id: telegramId, type: 'private' } } } });
    expect(calls.map(call => call.method)).toContain('answerCallbackQuery');
    await pool.query(`insert into notification ("userId", "actorId", kind, "eventKey") values ($1, $2, 'follow', $3)`, [userId, actorId, `follow:${runId}:2`]);
    expect((await outbox()).length).toBe(1);
  });

  it('deduplicates queued messages', async () => {
    const payload = { event: 'new', orderId: randomUUID(), title: 'Банки', counterpart: 'Аня' };
    await enqueueTelegram(pool, userId, 'market', payload, `market:new:${runId}`);
    await enqueueTelegram(pool, userId, 'market', payload, `market:new:${runId}`);
    expect((await outbox()).filter(row => row.kind === 'market')).toHaveLength(1);
  });

  it('retries after a flood limit and stops writing to a member who blocked the bot', async () => {
    reply = () => Response.json({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } });
    await deliverOutbox(pool, ctx.token, ctx.siteUrl);
    expect((await outbox()).find(row => row.kind === 'market')?.sentAt).toBeNull();

    await pool.query(`update "telegramOutbox" set "sendAfter" = now() where "chatId" = $1`, [telegramId]);
    reply = () => Response.json({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' });
    await deliverOwn();
    const market = (await outbox()).find(row => row.kind === 'market');
    expect(market?.sentAt).not.toBeNull();
    expect(market?.lastError).toContain('blocked');
    expect((await pool.query('select "blockedAt" from "telegramChat" where "telegramId" = $1', [telegramId])).rows[0]?.blockedAt).not.toBeNull();

    await enqueueTelegram(pool, userId, 'market', {}, `market:after-block:${runId}`);
    expect((await outbox()).length).toBe(2);
  });
});
