import { getPool } from '@/db/pool';
import { experienceLevel } from '@/lib/experience-level';
import { notBlockedBy } from '@/lib/member-blocks';
import { DEFAULT_PROFILE_APPEARANCE, parseProfileAppearance, type ProfileAppearance } from '@/lib/profile-appearance';
import { profileTagLabel } from '@/lib/profile-achievements';
import { frozenMessage } from '@/lib/moderation';
import type { PreparedWallMedia } from '@/lib/wall-media';
import type { WallMediaKind } from '@/lib/wall-media-limits';
import type { WallDrink } from '@/lib/wall-drink-fields';
import { isCatalogDrink, withWallDrinks } from '@/lib/wall-drinks';
import {
  CHAT_HOURLY_LIMIT, CHAT_PAGE, CHAT_PAUSE_SECONDS, CHAT_PRESENCE_SECONDS, ChatError, isChatId, isChatReaction, parseChatText,
  type ChatReactionEmoji,
} from '@/lib/community-chat-fields';

export { ChatError };

/**
 * «Чат сообщества»: one shared conversation behind the floating button (migration 0198). Messages come a page at a
 * time, newest page polled by the open panel; authors are sent once per page, apart from the messages. Members banned
 * by the site and members the viewer blocked are not shown; a reply to someone the viewer blocked shows no quote text.
 */
export interface ChatReaction { emoji: ChatReactionEmoji; count: number; mine: boolean }
export interface ChatReply {
  id: string | null; userId: string | null; username: string | null; name: string; text: string;
  /** `deleted` — the quoted message is gone; `hidden` — its author is blocked by the viewer or by the site. */
  state: 'shown' | 'hidden' | 'deleted';
}
export interface ChatMessage {
  id: string; userId: string; text: string; createdAt: string;
  replyTo: ChatReply | null; media: { id: string; kind: WallMediaKind }[]; drink: WallDrink | null; reactions: ChatReaction[];
}
export interface ChatAuthor {
  id: string; username: string | null; name: string; avatarId: string | null; frame: ProfileAppearance['frame'];
  level: number; tag: { key: string; label: string } | null; verified: boolean;
}
export interface ChatPage { items: ChatMessage[]; authors: Record<string, ChatAuthor>; hasMore: boolean }
export interface ChatPresence { count: number; people: { id: string; username: string; avatarId: string | null }[] }
/** Who is looking: what the composer may do. `blocked` — banned by the site; `frozen` — the freeze message. */
export interface ChatViewer { id: string; username: string | null; staff: boolean; blocked: boolean; frozen: string | null }

const VISIBLE = (viewer: string, author: string) => `not exists(select 1 from "userBlock" b where b."userId" = ${author}) and ${notBlockedBy(viewer, author)}`;

// The author as every chat row shows them: avatar with frame, level, the selected tag (a role only while it still
// matches, a bought tag only while owned) and the check mark.
const AUTHOR = `u.id, u.username, u.name, u."profileAppearance" as appearance, u."verifiedAt" is not null as verified,
  (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId",
  coalesce((select sum(points) from "profileExperience" e where e."userId" = u.id), 0)::int as xp,
  case when u."profileTags"[1] in ('admin', 'moderator') then case when exists(select 1 from "siteAdmin" a where a.email = lower(u.email) and a.role = u."profileTags"[1]) then u."profileTags"[1] end
    when exists(select 1 from "profileAchievement" a where a."userId" = u.id and a.key = u."profileTags"[1])
      or exists(select 1 from "shopPurchase" b where b."userId" = u.id and b.key = u."profileTags"[1]) then u."profileTags"[1] end as tag`;

interface AuthorRow { id: string; username: string | null; name: string; appearance: unknown; verified: boolean; avatarId: string | null; xp: number; tag: string | null }
const toAuthor = (row: AuthorRow): ChatAuthor => {
  const label = row.tag ? profileTagLabel(row.tag) : undefined;
  return {
    id: row.id, username: row.username, name: row.name, avatarId: row.avatarId, verified: row.verified,
    frame: (parseProfileAppearance(row.appearance) ?? DEFAULT_PROFILE_APPEARANCE).frame, level: experienceLevel(row.xp).level,
    tag: row.tag && label ? { key: row.tag, label } : null,
  };
};

export async function chatAuthors(ids: readonly string[]): Promise<Record<string, ChatAuthor>> {
  if (!ids.length) return {};
  const { rows } = await getPool().query<AuthorRow>(`select ${AUTHOR} from "user" u where u.id = any($1::text[])`, [[...new Set(ids)]]);
  return Object.fromEntries(rows.map(row => [row.id, toAuthor(row)]));
}

interface MessageRow {
  id: string; userId: string; text: string; createdAt: Date; drinkBrand: string | null; drinkFlavor: string | null;
  replyToId: string | null; replyToUserId: string | null; replyText: string | null; replyHidden: boolean | null; replyUsername: string | null; replyName: string | null;
  media: { id: string; kind: WallMediaKind }[]; reactions: ChatReaction[];
}

/**
 * The newest page of the chat for `viewer` (null for a guest), or the page before the message `before` — with its time
 * as a fallback when that message has been deleted meanwhile. Oldest first.
 */
export async function chatMessages(viewer: string | null, before?: { id: string; createdAt: string }): Promise<ChatPage> {
  if (before && !isChatId(before.id)) throw new ChatError('Некорректное сообщение.');
  const { rows } = await getPool().query<MessageRow>(`select m.id, m."userId", m.text, m."createdAt", m."drinkBrand", m."drinkFlavor",
      m."replyToId", m."replyToUserId", rm.text as "replyText", ru.username as "replyUsername", ru.name as "replyName",
      (rm.id is not null and not (${VISIBLE('$1::text', 'rm."userId"')})) as "replyHidden",
      coalesce((select json_agg(json_build_object('id', x.id::text, 'kind', x.kind) order by x.position) from "chatMedia" x where x."messageId" = m.id), '[]'::json) as media,
      coalesce((select json_agg(json_build_object('emoji', r.emoji, 'count', r.count, 'mine', r.mine) order by r.first, r.emoji)
        from (select c.emoji, count(*)::int as count, coalesce(bool_or(c."userId" = $1), false) as mine, min(c."createdAt") as first
          from "chatReaction" c where c."messageId" = m.id group by c.emoji) r), '[]'::json) as reactions
    from "chatMessage" m
    left join "chatMessage" rm on rm.id = m."replyToId"
    left join "user" ru on ru.id = m."replyToUserId"
    where ${VISIBLE('$1::text', 'm."userId"')}
      and ($2::uuid is null or (m."createdAt", m.id) < (coalesce((select "createdAt" from "chatMessage" where id = $2), $3::timestamptz), $2::uuid))
    order by m."createdAt" desc, m.id desc limit ${CHAT_PAGE + 1}`, [viewer, before?.id ?? null, before?.createdAt ?? null]);
  const page = await withWallDrinks(rows.slice(0, CHAT_PAGE).reverse());
  const items = page.map(row => ({
    id: row.id, userId: row.userId, text: row.text, createdAt: row.createdAt.toISOString(), media: row.media, reactions: row.reactions, drink: row.drink,
    replyTo: row.replyToId || row.replyToUserId ? {
      id: row.replyToId, userId: row.replyToUserId, username: row.replyUsername, name: row.replyName ?? 'Участник',
      text: row.replyToId && !row.replyHidden ? row.replyText ?? '' : '',
      state: !row.replyToId ? 'deleted' : row.replyHidden ? 'hidden' : 'shown',
    } satisfies ChatReply : null,
  }));
  return { items, authors: await chatAuthors(items.map(item => item.userId)), hasMore: rows.length > CHAT_PAGE };
}

export async function chatViewer(userId: string): Promise<ChatViewer> {
  const row = (await getPool().query<{ username: string | null; staff: boolean; blocked: boolean }>(`select u.username,
      exists(select 1 from "siteAdmin" a where a.email = lower(u.email)) as staff,
      exists(select 1 from "userBlock" b where b."userId" = u.id) as blocked
    from "user" u where u.id = $1`, [userId])).rows[0];
  if (!row) throw new ChatError('Войдите в аккаунт и повторите.');
  return { id: userId, ...row, frozen: await frozenMessage(userId) };
}

export interface ChatInput { text: unknown; replyToId?: string | null; media?: readonly PreparedWallMedia[]; drink?: { brand: string; flavor: string } | null }

/**
 * A member writes to the chat. Needs a nickname (the chat shows nicknames), no site ban; at most one message every
 * CHAT_PAUSE_SECONDS and CHAT_HOURLY_LIMIT an hour, checked under the member's row lock. The answered member comes from
 * the quoted message, never from the client; the database refuses a frozen author (CR002) and a reply between members
 * who blocked each other (CR001). Returns the new message's id.
 */
export async function sendChatMessage(userId: string, input: ChatInput): Promise<string> {
  const text = parseChatText(input.text);
  const media = input.media ?? [];
  const drink = input.drink ?? null;
  if (!text && !media.length && !drink) throw new ChatError('Напишите сообщение или прикрепите фото, видео или энергетик.');
  if (input.replyToId && !isChatId(input.replyToId)) throw new ChatError('Сообщение, на которое вы отвечаете, не найдено.');
  if (drink && !await isCatalogDrink(drink.brand, drink.flavor)) throw new ChatError('Этого энергетика нет в каталоге. Выберите другой.');
  const db = await getPool().connect();
  try {
    await db.query('begin');
    const member = (await db.query<{ username: string | null; blocked: boolean }>(`select username, exists(select 1 from "userBlock" b where b."userId" = u.id) as blocked
      from "user" u where id = $1 for no key update`, [userId])).rows[0];
    if (!member) throw new ChatError('Войдите в аккаунт и повторите.');
    if (member.blocked) throw new ChatError('Писать в чат этому аккаунту нельзя.');
    if (!member.username) throw new ChatError('Придумайте ник в настройках профиля, чтобы писать в чат.');
    const recent = (await db.query<{ last: number; hour: number }>(`select
        count(*) filter (where "createdAt" > now() - make_interval(secs => ${CHAT_PAUSE_SECONDS}))::int as last,
        count(*)::int as hour
      from "chatMessage" where "userId" = $1 and "createdAt" > now() - interval '1 hour'`, [userId])).rows[0]!;
    if (recent.last > 0) throw new ChatError('Не так быстро: следующее сообщение — через пару секунд.');
    if (recent.hour >= CHAT_HOURLY_LIMIT) throw new ChatError(`За час — не больше ${CHAT_HOURLY_LIMIT} сообщений. Продолжите чуть позже.`);
    let replyToUserId: string | null = null;
    if (input.replyToId) {
      const target = (await db.query<{ userId: string }>(`select m."userId" from "chatMessage" m
        where m.id = $1 and not exists(select 1 from "userBlock" b where b."userId" = m."userId")`, [input.replyToId])).rows[0];
      if (!target) throw new ChatError('Сообщение, на которое вы отвечаете, удалено.');
      replyToUserId = target.userId;
    }
    const id = (await db.query<{ id: string }>(`insert into "chatMessage" ("userId", text, "replyToId", "replyToUserId", "drinkBrand", "drinkFlavor")
      values ($1, $2, $3, $4, $5, $6) returning id`, [userId, text, input.replyToId || null, replyToUserId, drink?.brand ?? null, drink?.flavor ?? null])).rows[0]!.id;
    for (const [position, item] of media.entries()) {
      await db.query(`insert into "chatMedia" ("messageId", position, kind, mime, data, thumbnail) values ($1, $2, $3, $4, $5, $6)`,
        [id, position, item.kind, item.mime, item.data, item.thumbnail]);
    }
    await db.query('commit');
    return id;
  } catch (error) { await db.query('rollback'); throw error; } finally { db.release(); }
}

/** The author takes their own message down (its attachments and reactions go with it). */
export async function deleteOwnChatMessage(userId: string, id: string): Promise<boolean> {
  if (!isChatId(id)) return false;
  return Boolean((await getPool().query('delete from "chatMessage" where id = $1 and "userId" = $2', [id, userId])).rowCount);
}

async function messageReactions(viewer: string, id: string): Promise<ChatReaction[]> {
  const { rows } = await getPool().query<ChatReaction>(`select emoji, count(*)::int as count, bool_or("userId" = $2) as mine
    from "chatReaction" where "messageId" = $1 group by emoji order by min("createdAt"), emoji`, [id, viewer]);
  return rows;
}

/**
 * Puts the viewer's reaction on a message or, pressed again, takes it off; returns the message's reactions as they are
 * now. A message the viewer cannot see is refused; a reaction between members who blocked each other is refused by the
 * database (CR001).
 */
export async function toggleChatReaction(userId: string, id: string, emoji: unknown): Promise<ChatReaction[]> {
  if (!isChatId(id) || !isChatReaction(emoji)) throw new ChatError('Такой реакции нет.');
  const db = getPool();
  const visible = await db.query(`select 1 from "chatMessage" m where m.id = $1 and ${VISIBLE('$2::text', 'm."userId"')}`, [id, userId]);
  if (!visible.rowCount) throw new ChatError('Сообщение удалено.');
  const removed = await db.query('delete from "chatReaction" where "messageId" = $1 and "userId" = $2 and emoji = $3', [id, userId, emoji]);
  if (!removed.rowCount) await db.query('insert into "chatReaction" ("messageId", "userId", emoji) values ($1, $2, $3) on conflict do nothing', [id, userId, emoji]);
  return messageReactions(userId, id);
}

/** The open panel says the member is here; closing it says they left, so the header updates sooner. */
export async function touchChatPresence(userId: string): Promise<void> {
  await getPool().query(`insert into "chatPresence" ("userId", "seenAt") values ($1, now())
    on conflict ("userId") do update set "seenAt" = now()`, [userId]);
}
export async function leaveChatPresence(userId: string): Promise<void> {
  await getPool().query('delete from "chatPresence" where "userId" = $1', [userId]);
}

/**
 * Who has the chat open now: members with a nickname who did not hide their online status, are not banned and not
 * blocked by the viewer. The header shows a few avatars and the count.
 */
export async function chatPresence(viewer: string | null, limit = 3): Promise<ChatPresence> {
  const { rows } = await getPool().query<{ id: string; username: string; avatarId: string | null; total: number }>(`select u.id, u.username,
      (select p.id::text from "profileImage" p where p."userId" = u.id and p.kind = 'avatar') as "avatarId", count(*) over()::int as total
    from "chatPresence" c join "user" u on u.id = c."userId"
    where c."seenAt" > now() - make_interval(secs => ${CHAT_PRESENCE_SECONDS}) and u.username is not null and u."showOnline" is not false
      and ${VISIBLE('$1::text', 'u.id')}
    order by c."seenAt" desc, u.id limit $2`, [viewer, limit]);
  return { count: rows[0]?.total ?? 0, people: rows.map(({ id, username, avatarId }) => ({ id, username, avatarId })) };
}
