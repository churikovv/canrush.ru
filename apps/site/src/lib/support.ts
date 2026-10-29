import { getPool } from '@/db/pool';
import { SUPPORT_TEXT_LIMIT } from '@/lib/support-limits';

export { SUPPORT_TEXT_LIMIT };

/** «Помощь»: a member's chat with the CanRush team — one thread per member, text messages, read marks on both sides. */
const PAGE = 50;

export class SupportError extends Error {}

export interface SupportMessage { id: string; fromStaff: boolean; text: string; createdAt: string; author: string | null }
export interface SupportThread {
  id: string; userId: string; status: 'open' | 'closed'; lastMessageAt: string; lastFromStaff: boolean;
  userReadAt: string | null; staffReadAt: string | null; createdAt: string;
}
/** A thread in the team's list: the member, the last line and whether the team has read it. */
export interface SupportThreadRow extends SupportThread {
  name: string; username: string | null; email: string; avatarId: string | null; preview: string; unread: boolean; messages: number;
  /** The company the member owns or works in: they may be writing from the business cabinet. */
  business: string | null;
}

const THREAD = `t.id, t."userId", t.status, t."lastMessageAt", t."lastFromStaff", t."userReadAt", t."staffReadAt", t."createdAt"`;
const iso = (value: Date | string | null) => value === null ? null : new Date(value).toISOString();
const toThread = (row: Record<string, unknown>): SupportThread => ({
  id: row.id as string, userId: row.userId as string, status: row.status as SupportThread['status'],
  lastMessageAt: iso(row.lastMessageAt as Date)!, lastFromStaff: row.lastFromStaff as boolean,
  userReadAt: iso(row.userReadAt as Date | null), staffReadAt: iso(row.staffReadAt as Date | null), createdAt: iso(row.createdAt as Date)!,
});

/** Text of a message: trimmed, line breaks kept, within the limit. */
export function parseSupportText(value: unknown): string {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!text) throw new SupportError('Напишите сообщение.');
  if (text.length > SUPPORT_TEXT_LIMIT) throw new SupportError(`Сообщение — до ${SUPPORT_TEXT_LIMIT} символов.`);
  return text;
}

/** The newest page of a thread's messages (or the page before `before`), oldest first, and whether older ones exist. */
export async function supportMessages(threadId: string, before?: string): Promise<{ items: SupportMessage[]; hasMore: boolean }> {
  const { rows } = await getPool().query<{ id: string; fromStaff: boolean; text: string; createdAt: Date; author: string | null }>(
    `select m.id, m."fromStaff", m.text, m."createdAt", case when m."fromStaff" then 'Поддержка CanRush' else u.name end as author
     from "supportMessage" m left join "user" u on u.id = m."senderId"
     where m."threadId" = $1 and ($2::uuid is null or (m."createdAt", m.id) < (select "createdAt", id from "supportMessage" where id = $2))
     order by m."createdAt" desc, m.id desc limit ${PAGE + 1}`, [threadId, before ?? null]);
  return { items: rows.slice(0, PAGE).reverse().map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), hasMore: rows.length > PAGE };
}

/** The member's own thread, if they have written. */
export async function getOwnSupportThread(userId: string): Promise<SupportThread | null> {
  const row = (await getPool().query(`select ${THREAD} from "supportThread" t where t."userId" = $1`, [userId])).rows[0];
  return row ? toThread(row) : null;
}

/** Whether the team answered after the member last read their thread — the settings row shows it. */
export async function supportUnreadForUser(userId: string): Promise<boolean> {
  return Boolean((await getPool().query(`select 1 from "supportThread" where "userId" = $1 and "lastFromStaff"
    and ("userReadAt" is null or "userReadAt" < "lastMessageAt")`, [userId])).rowCount);
}

/**
 * A member writes to the team: the thread is created on the first message and reopens when closed. At most one message
 * every two seconds and twenty an hour, so a stuck key or a script cannot flood the team.
 */
export async function sendSupportMessage(userId: string, value: unknown): Promise<void> {
  const text = parseSupportText(value);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await db.query('select 1 from "user" where id = $1 for no key update', [userId]);
    const thread = (await db.query<{ id: string }>(`insert into "supportThread"("userId") values ($1)
      on conflict ("userId") do update set status = 'open' returning id`, [userId])).rows[0]!;
    const recent = (await db.query<{ last: number; hour: number }>(`select
        count(*) filter (where "createdAt" > now() - interval '2 seconds')::int as last,
        count(*) filter (where "createdAt" > now() - interval '1 hour')::int as hour
      from "supportMessage" where "threadId" = $1 and not "fromStaff"`, [thread.id])).rows[0]!;
    if (recent.last > 0) throw new SupportError('Подождите пару секунд перед следующим сообщением.');
    if (recent.hour >= 20) throw new SupportError('Слишком много сообщений за час — мы уже читаем ваше обращение.');
    await db.query(`insert into "supportMessage"("threadId", "senderId", "fromStaff", text) values ($1, $2, false, $3)`, [thread.id, userId, text]);
    await db.query(`update "supportThread" set "lastMessageAt" = now(), "lastFromStaff" = false, "userReadAt" = now() where id = $1`, [thread.id]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** The member opened their thread: the team's replies are read (and their notifications too). */
export async function readOwnSupport(userId: string): Promise<void> {
  await getPool().query(`update "supportThread" set "userReadAt" = now() where "userId" = $1`, [userId]);
  await getPool().query(`update notification set "readAt" = now() where "userId" = $1 and kind = 'support-reply' and "readAt" is null`, [userId]);
}

/** The team's view needs a member of the site team; checked by id in SQL, like the other staff actions. */
async function assertStaff(db: { query: ReturnType<typeof getPool>['query'] }, staffUserId: string) {
  const staff = await db.query(`select 1 from "user" u join "siteAdmin" a on a.email = lower(u.email) where u.id = $1`, [staffUserId]);
  if (!staff.rowCount) throw new SupportError('Нет доступа.');
}

export type SupportView = 'open' | 'unread' | 'closed' | 'all';
/** The team's list: newest first; «Ждут ответа» — open threads whose last word is the member's. */
export async function listSupportThreads(view: SupportView = 'open', query = ''): Promise<SupportThreadRow[]> {
  const q = query.trim().toLowerCase();
  const { rows } = await getPool().query(`select ${THREAD}, u.name, u.username, u.email,
      (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
      (select b.name from business b where b."ownerId" = u.id
         or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = u.id and m.status = 'active') limit 1) as business,
      (select left(text, 140) from "supportMessage" where "threadId" = t.id order by "createdAt" desc, id desc limit 1) as preview,
      (select count(*)::int from "supportMessage" where "threadId" = t.id) as messages,
      (not t."lastFromStaff" and (t."staffReadAt" is null or t."staffReadAt" < t."lastMessageAt")) as unread
    from "supportThread" t join "user" u on u.id = t."userId"
    where case $1 when 'open' then t.status = 'open' when 'closed' then t.status = 'closed'
      when 'unread' then t.status = 'open' and not t."lastFromStaff" else true end
      and ($2 = '' or lower(u.name) like '%' || $2 || '%' or lower(coalesce(u.username, '')) like '%' || $2 || '%' or lower(u.email) like '%' || $2 || '%'
        or exists(select 1 from "supportMessage" m where m."threadId" = t.id and lower(m.text) like '%' || $2 || '%'))
    order by t."lastMessageAt" desc limit 200`, [view, q]);
  return rows.map(row => ({ ...toThread(row), name: row.name, username: row.username, email: row.email, avatarId: row.avatarId, preview: row.preview ?? '', unread: row.unread, messages: row.messages, business: row.business ?? null }));
}

/** How many open threads wait for the team — the sidebar's badge. */
export async function countSupportWaiting(): Promise<number> {
  return (await getPool().query<{ count: number }>(`select count(*)::int as count from "supportThread" where status = 'open' and not "lastFromStaff"`)).rows[0]?.count ?? 0;
}

export async function getSupportThread(id: string): Promise<SupportThreadRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await getPool().query(`select ${THREAD}, u.name, u.username, u.email,
      (select id::text from "profileImage" where "userId" = u.id and kind = 'avatar') as "avatarId",
      (select b.name from business b where b."ownerId" = u.id
         or exists(select 1 from "businessMember" m where m."businessId" = b.id and m."userId" = u.id and m.status = 'active') limit 1) as business, '' as preview,
      (select count(*)::int from "supportMessage" where "threadId" = t.id) as messages, false as unread
    from "supportThread" t join "user" u on u.id = t."userId" where t.id = $1`, [id]);
  const row = rows[0];
  return row ? { ...toThread(row), name: row.name, username: row.username, email: row.email, avatarId: row.avatarId, preview: '', unread: false, messages: row.messages, business: row.business ?? null } : null;
}

/** A team reply: the member is notified by the `support_message_notify` trigger; the thread stays open. */
export async function replySupport(staffUserId: string, threadId: string, value: unknown): Promise<void> {
  const text = parseSupportText(value);
  const db = await getPool().connect();
  try {
    await db.query('begin');
    await assertStaff(db, staffUserId);
    const thread = await db.query(`update "supportThread" set "lastMessageAt" = now(), "lastFromStaff" = true, "staffReadAt" = now(), status = 'open'
      where id = $1 returning id`, [threadId]);
    if (!thread.rowCount) throw new SupportError('Обращение не найдено.');
    await db.query(`insert into "supportMessage"("threadId", "senderId", "fromStaff", text) values ($1, $2, true, $3)`, [threadId, staffUserId, text]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

export async function readSupportAsStaff(staffUserId: string, threadId: string): Promise<void> {
  await assertStaff(getPool(), staffUserId);
  await getPool().query(`update "supportThread" set "staffReadAt" = now() where id = $1`, [threadId]);
}

/** Close a solved thread, or open it again; the member's next message reopens it anyway. */
export async function setSupportStatus(staffUserId: string, threadId: string, status: 'open' | 'closed'): Promise<void> {
  await assertStaff(getPool(), staffUserId);
  await getPool().query(`update "supportThread" set status = $2 where id = $1`, [threadId, status]);
}
