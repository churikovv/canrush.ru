/**
 * @mentions: "@" not glued to a word, an e-mail or a link, then a username (3–24 latin letters, digits, "_").
 * The same rule notifies the mentioned member in the database (notify_mentions, migration 0076).
 */
const MENTION = /(^|[^A-Za-z0-9_.@/])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])/gu;

export type MentionPart = { text: string } | { username: string; text: string };

/** Splits a text into plain runs and mentions; usernames are lower-cased like stored ones. */
export function splitMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const start = match.index + match[1]!.length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ username: match[2]!.toLowerCase(), text: `@${match[2]}` });
    last = start + 1 + match[2]!.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** The handle being typed right before the caret ("@ab|"), for suggestions; null when the caret is not in one. */
export function mentionQuery(value: string, caret: number): { start: number; query: string } | null {
  const match = /(^|[^A-Za-z0-9_.@/])@([A-Za-z0-9_]{0,24})$/u.exec(value.slice(0, caret));
  return match ? { start: caret - match[2]!.length - 1, query: match[2]!.toLowerCase() } : null;
}
