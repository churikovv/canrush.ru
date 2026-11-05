import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/canrush_site_test';
if (new URL(url).pathname !== '/canrush_site_test') throw new Error('Test DB only');
const pool = new Pool({ connectionString: url, max: 4, allowExitOnIdle: true });
vi.mock('../src/db/pool', () => ({ getPool: () => pool }));
const chat = await import('../src/lib/community-chat');
const { CHAT_HOURLY_LIMIT, CHAT_PAGE } = await import('../src/lib/community-chat-fields');
const { staffDeleteContent } = await import('../src/lib/staff-moderation');
const { createContentReport } = await import('../src/lib/profile-reports');
const { drinkCatalog } = await import('../src/lib/wall-drinks');
const { blockMember } = await import('../src/lib/member-blocks');

const run = randomUUID().replaceAll('-', '').slice(0, 10);
const id = (): string => randomUUID();
const anna = id(), boris = id(), viktor = id(), nonick = id(), banned = id(), frozen = id(), staff = id();
const people: string[] = [anna, boris, viktor, nonick, banned, frozen, staff];
const staffEmail = `${staff}@example.com`;
const nick = (member: string) => `ch${people.indexOf(member)}${run}`;
const ours = <Item extends { userId: string }>(items: Item[]) => items.filter(item => people.includes(item.userId));
const image = { kind: 'image' as const, mime: 'image/webp' as const, data: Buffer.from('webp-data'), thumbnail: Buffer.from('webp-thumb') };
/** The pause between messages is three seconds: tests move a member's earlier messages back instead of waiting. */
const rewind = (userId: string, seconds = 10) => pool.query(`update "chatMessage" set "createdAt" = "createdAt" - make_interval(secs => $2) where "userId" = $1`, [userId, seconds]);
let drink = { brand: '', flavor: '' };

beforeAll(async () => {
  for (const member of people) {
    await pool.query(`insert into "user"(id,name,email,"emailVerified","createdAt","updatedAt",username) values($1,'Чат тест',$2,true,now(),now(),$3)`,
      [member, `${member}@example.com`, member === nonick ? null : nick(member)]);
  }
  await pool.query(`insert into "userBlock"("userId") values ($1)`, [banned]);
  await pool.query(`insert into "userFreeze"("userId", until) values ($1, now() + interval '1 day')`, [frozen]);
  await pool.query(`insert into "siteAdmin"(email, role) values ($1, 'moderator')`, [staffEmail]);
  await pool.query(`update "user" set "verifiedAt" = now(), "profileAppearance" = '{"theme":"default","frame":"orbit"}'::jsonb where id = $1`, [anna]);
  await pool.query(`insert into "profileExperience"("userId", points, reason, "sourceKey") values ($1, 150, 'review', $2)`, [anna, `chat-${run}`]);
  const first = [...(await drinkCatalog()).values()][0]!;
  drink = { brand: first.brand, flavor: first.flavor };
});
afterAll(async () => {
  await pool.query('delete from "adminAuditLog" where "adminEmail" = $1', [staffEmail]);
  await pool.query('delete from "siteAdmin" where email = $1', [staffEmail]);
  await pool.query('delete from "user" where id = any($1::text[])', [people]);
  await pool.end();
});

describe('writing', () => {
  it('needs a nickname, no ban and no freeze, and refuses an empty message or a drink outside the catalog', async () => {
    await expect(chat.sendChatMessage(nonick, { text: 'Привет' })).rejects.toThrow('ник');
    await expect(chat.sendChatMessage(banned, { text: 'Привет' })).rejects.toThrow('нельзя');
    await expect(chat.sendChatMessage(frozen, { text: 'Привет' })).rejects.toMatchObject({ code: 'CR002' });
    await expect(chat.sendChatMessage(anna, { text: '   ' })).rejects.toThrow('Напишите');
    await expect(chat.sendChatMessage(anna, { text: 'Пью', drink: { brand: 'Нет такого', flavor: run } })).rejects.toThrow('каталоге');
    expect((await chat.chatViewer(nonick)).username).toBeNull();
    expect(await chat.chatViewer(banned)).toMatchObject({ blocked: true, staff: false });
    expect((await chat.chatViewer(frozen)).frozen).toMatch(/заморожен/);
    expect((await chat.chatViewer(staff)).staff).toBe(true);
  });

  it('shows a message to everyone with its author: nickname, level, frame, tag rules and the check mark', async () => {
    await chat.sendChatMessage(anna, { text: `Всем привет ${run}` });
    const page = await chat.chatMessages(null);
    const mine = ours(page.items);
    expect(mine.map(item => item.text)).toEqual([`Всем привет ${run}`]);
    expect(page.authors[anna]).toMatchObject({ username: nick(anna), frame: 'orbit', verified: true, tag: null });
    expect(page.authors[anna]!.level).toBeGreaterThan(1);
  });

  it('keeps a pause between messages and a limit per hour', async () => {
    await expect(chat.sendChatMessage(anna, { text: 'Ещё' })).rejects.toThrow('пару секунд');
    await rewind(anna, 4000);
    await pool.query(`insert into "chatMessage"("userId", text, "createdAt") select $1, 'много', now() - interval '20 minutes' from generate_series(1, $2)`, [anna, CHAT_HOURLY_LIMIT]);
    await expect(chat.sendChatMessage(anna, { text: 'Ещё' })).rejects.toThrow(`${CHAT_HOURLY_LIMIT}`);
    await pool.query(`delete from "chatMessage" where "userId" = $1 and text = 'много'`, [anna]);
  });

  it('may be only a photo or only a drink from the catalog', async () => {
    const photo = await chat.sendChatMessage(boris, { text: '', media: [image] });
    await rewind(boris);
    const withDrink = await chat.sendChatMessage(boris, { text: '', drink });
    const items = ours((await chat.chatMessages(boris)).items);
    expect(items.find(item => item.id === photo)?.media).toEqual([{ id: expect.any(String), kind: 'image' }]);
    expect(items.find(item => item.id === withDrink)?.drink).toMatchObject({ brand: drink.brand, flavor: drink.flavor, href: expect.stringMatching(/^\/catalog\//) });
    // Without the attachment the message would be empty: the database checks it at commit.
    await expect(pool.query(`insert into "chatMessage"("userId", text) values ($1, '')`, [viktor])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('replies, mentions and reactions', () => {
  it('quotes the answered message, notifies its author and the mentioned member, and marks a deleted original', async () => {
    const original = ours((await chat.chatMessages(null)).items).find(item => item.userId === anna)!;
    await rewind(boris);
    const reply = await chat.sendChatMessage(boris, { text: `Привет! @${nick(viktor)} заходи`, replyToId: original.id });
    const item = (await chat.chatMessages(viktor)).items.find(entry => entry.id === reply)!;
    expect(item.replyTo).toMatchObject({ id: original.id, userId: anna, username: nick(anna), state: 'shown', text: `Всем привет ${run}` });
    const notes = (await pool.query(`select "userId", kind, payload from notification where "actorId" = $1 order by kind`, [boris])).rows;
    expect(notes).toEqual([
      { userId: anna, kind: 'comment-reply', payload: { target: 'chat', messageId: reply, text: expect.stringContaining('заходи') } },
      { userId: viktor, kind: 'mention', payload: { target: 'chat', messageId: reply, text: expect.stringContaining('заходи') } },
    ]);
    expect(await chat.deleteOwnChatMessage(boris, original.id)).toBe(false);
    expect(await chat.deleteOwnChatMessage(anna, original.id)).toBe(true);
    const after = (await chat.chatMessages(viktor)).items.find(entry => entry.id === reply)!;
    expect(after.replyTo).toMatchObject({ id: null, userId: anna, state: 'deleted', text: '' });
    await rewind(anna);
    await expect(chat.sendChatMessage(anna, { text: 'Ответ', replyToId: original.id })).rejects.toThrow('удалено');
  });

  it('turns a reaction on and off and counts everyone’s', async () => {
    const target = ours((await chat.chatMessages(null)).items).find(item => item.userId === boris && item.text.includes('заходи'))!;
    expect(await chat.toggleChatReaction(viktor, target.id, '🔥')).toEqual([{ emoji: '🔥', count: 1, mine: true }]);
    expect(await chat.toggleChatReaction(anna, target.id, '🔥')).toEqual([{ emoji: '🔥', count: 2, mine: true }]);
    await chat.toggleChatReaction(anna, target.id, '👍');
    expect((await chat.chatMessages(viktor)).items.find(item => item.id === target.id)?.reactions).toEqual([
      { emoji: '🔥', count: 2, mine: true }, { emoji: '👍', count: 1, mine: false }]);
    expect(await chat.toggleChatReaction(anna, target.id, '🔥')).toEqual([{ emoji: '🔥', count: 1, mine: false }, { emoji: '👍', count: 1, mine: true }]);
    await expect(chat.toggleChatReaction(anna, target.id, '💩')).rejects.toThrow('реакции');
  });
});

describe('blocks and moderation', () => {
  it('hides a blocked member’s messages from the blocker and refuses replies and reactions between them', async () => {
    const own = ours((await chat.chatMessages(null)).items).filter(item => item.userId === boris);
    expect(own.length).toBeGreaterThan(0);
    expect(await blockMember(viktor, boris)).toBe(true);
    expect(ours((await chat.chatMessages(viktor)).items).some(item => item.userId === boris)).toBe(false);
    expect(ours((await chat.chatMessages(anna)).items).some(item => item.userId === boris)).toBe(true);
    await rewind(boris);
    const fromViktor = await chat.sendChatMessage(viktor, { text: 'Я тут' });
    // A reply or a reaction between the two is refused by the database, whoever blocked whom.
    await expect(chat.sendChatMessage(boris, { text: 'Ответ', replyToId: fromViktor })).rejects.toMatchObject({ code: 'CR001' });
    await expect(chat.toggleChatReaction(boris, fromViktor, '👍')).rejects.toMatchObject({ code: 'CR001' });
    await expect(chat.toggleChatReaction(viktor, own[0]!.id, '👍')).rejects.toThrow('удалено');
    // The quote of a blocked member's message keeps their name but not the text.
    await rewind(anna);
    const replyToBoris = await chat.sendChatMessage(anna, { text: 'Согласна', replyToId: own.at(-1)!.id });
    expect((await chat.chatMessages(viktor)).items.find(item => item.id === replyToBoris)?.replyTo).toMatchObject({ state: 'hidden', text: '' });
    await pool.query('delete from "memberBlock" where "blockerId" = $1', [viktor]);
  });

  it('hides messages of a member banned by the site from everyone', async () => {
    await pool.query(`insert into "chatMessage"("userId", text) values ($1, 'до бана')`, [banned]);
    expect(ours((await chat.chatMessages(null)).items).some(item => item.userId === banned)).toBe(false);
  });

  it('lets others report a message and the team delete it in place, written to the audit log', async () => {
    const message = ours((await chat.chatMessages(null)).items).find(item => item.userId === viktor)!;
    expect(await createContentReport(anna, 'chat-message', message.id, 'spam', '', '/')).toBe('sent');
    expect(await createContentReport(viktor, 'chat-message', message.id, 'spam', '', '/')).toBe('invalid');
    const report = (await pool.query(`select "targetId", excerpt from "profileReport" where "userId" = $1 and "contentId" = $2`, [anna, message.id])).rows[0];
    expect(report).toEqual({ targetId: viktor, excerpt: 'Я тут' });
    expect(await staffDeleteContent(anna, 'chat-message', message.id)).toBe(false);
    expect(await staffDeleteContent(staff, 'chat-message', message.id)).toBe(true);
    expect((await pool.query(`select 1 from "adminAuditLog" where "adminEmail" = $1 and "targetType" = 'chat-message' and "targetId" = $2`, [staffEmail, message.id])).rowCount).toBe(1);
    await pool.query('delete from "profileReport" where "userId" = $1', [anna]);
  });
});

describe('pages, presence and drinks', () => {
  it('loads older pages before a message, even one deleted meanwhile', async () => {
    await pool.query(`insert into "chatMessage"("userId", text, "createdAt")
      select $1, 'старое ' || n, now() - interval '3 days' + make_interval(secs => n) from generate_series(1, $2) n`, [viktor, CHAT_PAGE + 5]);
    const old = (await pool.query<{ id: string; createdAt: Date }>(`select id, "createdAt" from "chatMessage" where "userId" = $1 and text like 'старое %' order by "createdAt" desc limit 1`, [viktor])).rows[0]!;
    const page = await chat.chatMessages(null, { id: old.id, createdAt: old.createdAt.toISOString() });
    expect(ours(page.items).slice(-2).map(item => item.text)).toEqual([`старое ${CHAT_PAGE + 3}`, `старое ${CHAT_PAGE + 4}`]);
    await pool.query('delete from "chatMessage" where id = $1', [old.id]);
    const again = await chat.chatMessages(null, { id: old.id, createdAt: old.createdAt.toISOString() });
    expect(ours(again.items).at(-1)?.text).toBe(`старое ${CHAT_PAGE + 4}`);
  });

  it('shows who has the chat open, without hidden statuses, banned or blocked members', async () => {
    for (const member of [anna, boris, viktor, banned]) await chat.touchChatPresence(member);
    await pool.query(`update "user" set "showOnline" = false where id = $1`, [viktor]);
    const seen = (await chat.chatPresence(null, 50)).people.map(person => person.id);
    expect(seen).toEqual(expect.arrayContaining([anna, boris]));
    expect(seen).not.toContain(viktor);
    expect(seen).not.toContain(banned);
    await blockMember(anna, boris);
    expect((await chat.chatPresence(anna, 50)).people.map(person => person.id)).not.toContain(boris);
    await chat.leaveChatPresence(anna);
    expect((await chat.chatPresence(null, 50)).people.map(person => person.id)).not.toContain(anna);
    await pool.query(`update "chatPresence" set "seenAt" = now() - interval '5 minutes' where "userId" = $1`, [boris]);
    expect((await chat.chatPresence(null, 50)).people.map(person => person.id)).not.toContain(boris);
  });

  it('moves the drink of a chat message when drinks are merged', async () => {
    const target = { brand: `Склейка ${run}`, flavor: 'merged' };
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select move_drink_identity($1, $2, $3, $4)', [drink.brand, drink.flavor, target.brand, target.flavor]);
      const moved = (await client.query(`select "drinkBrand", "drinkFlavor" from "chatMessage" where "userId" = $1 and "drinkBrand" is not null`, [boris])).rows;
      expect(moved).toEqual([{ drinkBrand: target.brand, drinkFlavor: target.flavor }]);
    } finally { await client.query('rollback'); client.release(); }
  });
});
