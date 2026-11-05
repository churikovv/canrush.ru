/**
 * The community chat's rules without the database, shared by the panel and the server: limits, the reaction set,
 * how a text is cleaned, how messages fall into groups and how a polled page merges into what the panel holds.
 */
export const CHAT_TEXT_LIMIT = 1000;
/** A pause between two messages of one member and how many fit in an hour: a stuck key or a script cannot flood the chat. */
export const CHAT_PAUSE_SECONDS = 3;
export const CHAT_HOURLY_LIMIT = 60;
/** Messages per page: the newest page is polled, older ones come with «Показать предыдущие». */
export const CHAT_PAGE = 40;
/** The open panel asks the server this often (only while the tab is visible), with a GET of `/api/chat` and not a
 * server action: Next runs server actions one at a time, so a poll would hold up a message being sent. */
export const CHAT_POLL_MS = 4000;
/** Someone is «в чате» while their open panel polled in the last half minute. */
export const CHAT_PRESENCE_SECONDS = 30;
/** Messages of one author closer than this stay in one group (one avatar and name for all). */
export const CHAT_GROUP_MINUTES = 5;
/** Reactions under a message; the database checks the same list (migration 0198). */
export const CHAT_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '⚡', '👎'] as const;
export type ChatReactionEmoji = typeof CHAT_REACTIONS[number];

export class ChatError extends Error {}

export function isChatReaction(value: unknown): value is ChatReactionEmoji {
  return typeof value === 'string' && (CHAT_REACTIONS as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function isChatId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * The text of a message: line breaks kept (three blank lines at most), trailing spaces dropped, trimmed. May be empty —
 * then the message needs an attachment or a drink, which the caller checks.
 */
export function parseChatText(value: unknown): string {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (text.length > CHAT_TEXT_LIMIT) throw new ChatError(`Сообщение — до ${CHAT_TEXT_LIMIT} символов.`);
  return text;
}

/** The start of a quoted message on one line, for the reply strip and the composer's «В ответ». */
export function quoteSnippet(text: string, length = 90): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > length ? `${line.slice(0, length - 1).trimEnd()}…` : line;
}

export const moscowDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });

/** «Сегодня», «Вчера» or a date — the separator between days; `now` is passed by tests. */
export function chatDayLabel(iso: string, now = new Date()): string {
  const day = moscowDay(iso);
  if (day === moscowDay(now.toISOString())) return 'Сегодня';
  if (day === moscowDay(new Date(now.getTime() - 86_400_000).toISOString())) return 'Вчера';
  const sameYear = day.slice(0, 4) === moscowDay(now.toISOString()).slice(0, 4);
  return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

export interface ChatGroupable { id: string; userId: string; createdAt: string; replyTo?: unknown }
export interface ChatGroup<Message extends ChatGroupable> { key: string; userId: string; day: string; newDay: boolean; messages: Message[] }

/**
 * Consecutive messages of one author fall into one group (one avatar, name and time), as in the reference chat: a new
 * group starts with another author, a new Moscow day or a pause longer than CHAT_GROUP_MINUTES. A reply always starts
 * a new group, so its quote sits under the name and not between two bubbles.
 */
export function groupChatMessages<Message extends ChatGroupable>(messages: readonly Message[]): ChatGroup<Message>[] {
  const groups: ChatGroup<Message>[] = [];
  for (const message of messages) {
    const last = groups.at(-1);
    const previous = last?.messages.at(-1);
    const day = moscowDay(message.createdAt);
    const close = previous && Date.parse(message.createdAt) - Date.parse(previous.createdAt) <= CHAT_GROUP_MINUTES * 60_000;
    if (last && previous && last.userId === message.userId && last.day === day && close && !message.replyTo) last.messages.push(message);
    else groups.push({ key: message.id, userId: message.userId, day, newDay: !last || last.day !== day, messages: [message] });
  }
  return groups;
}

const byTime = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Two values the server sent as JSON are the same: the poll keeps what did not change, so React redraws nothing. */
export const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Puts a freshly polled newest page into what the panel holds. Older pages loaded before stay; everything from the
 * page's oldest message on is replaced by the page, so deleted messages leave and reactions update. When the page has
 * nothing in common with what is held (the panel was asleep and many messages came), it starts over from the page.
 * A message that did not change stays the same object, and a page that changed nothing returns `held` itself: the
 * panel polls every few seconds and must not redraw forty messages with their avatar frames each time.
 */
export function mergeChatPage<Message extends { id: string; createdAt: string }>(held: readonly Message[], page: readonly Message[], pageHasMore: boolean): { items: readonly Message[]; reset: boolean } {
  // The newest page is empty only when the chat is: nothing held survives.
  if (!page.length) return { items: held.length ? [] : held, reset: held.length > 0 };
  const first = page[0]!;
  const known = new Map(held.map(item => [item.id, item]));
  const fresh = page.map(item => { const old = known.get(item.id); return old && sameJson(old, item) ? old : item; });
  if (pageHasMore && held.length && !page.some(item => known.has(item.id))) return { items: fresh, reset: true };
  const items = [...held.filter(item => byTime(item, first) < 0), ...fresh];
  const unchanged = items.length === held.length && items.every((item, index) => item === held[index]);
  return { items: unchanged ? held : items, reset: false };
}

/** Authors of a polled page over those held: unchanged authors stay the same objects, and nothing new returns `held`. */
export function mergeChatAuthors<Author>(held: Readonly<Record<string, Author>>, fresh: Readonly<Record<string, Author>>): Readonly<Record<string, Author>> {
  const changed = Object.entries(fresh).filter(([id, author]) => !sameJson(held[id], author));
  return changed.length ? { ...held, ...Object.fromEntries(changed) } : held;
}

/** Adds an older page in front of what is held, without duplicates. */
export function prependChatPage<Message extends { id: string; createdAt: string }>(held: readonly Message[], page: readonly Message[]): Message[] {
  return [...new Map([...page, ...held].map(item => [item.id, item])).values()].sort(byTime);
}

export interface ChatReactionCount { emoji: ChatReactionEmoji; count: number; mine: boolean }
/** The viewer pressed a reaction: on (count + 1) or, when it was theirs, off — what the panel shows before the server answers. */
export function toggleReaction(reactions: readonly ChatReactionCount[], emoji: ChatReactionEmoji): ChatReactionCount[] {
  const found = reactions.find(item => item.emoji === emoji);
  if (!found) return [...reactions, { emoji, count: 1, mine: true }];
  if (!found.mine) return reactions.map(item => item.emoji === emoji ? { ...item, count: item.count + 1, mine: true } : item);
  return reactions.flatMap(item => item.emoji !== emoji ? [item] : item.count > 1 ? [{ ...item, count: item.count - 1, mine: false }] : []);
}

/** The composer's emoji picker: a short, hand-picked set in three groups — enough for a chat about energy drinks. */
export const CHAT_EMOJI: readonly { title: string; emoji: readonly string[] }[] = [
  { title: 'Эмоции', emoji: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '😏', '😅', '🙂', '😉', '🤔', '🙄', '😴', '🤯', '🥳', '😇', '🤤', '😋', '😱', '😭', '😡', '🥲'] },
  { title: 'Жесты', emoji: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '👋', '✌️', '🤞', '👌', '🤙', '❤️', '💔', '💯', '👀'] },
  { title: 'Энергия', emoji: ['⚡', '🔥', '💥', '✨', '🚀', '🎉', '🏆', '🥇', '🎮', '🎧', '🧊', '🌙', '☀️', '🥤', '🍋', '🍓', '🍒', '🍉', '🍍', '🥭', '🍑', '🥥', '🍇', '🍏'] },
];
