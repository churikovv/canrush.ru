import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommunityChat } from '@/components/community-chat';
import {
  CHAT_EMOJI, CHAT_REACTIONS, CHAT_TEXT_LIMIT, ChatError, chatDayLabel, groupChatMessages, isChatId, isChatReaction, mergeChatPage, parseChatText,
  prependChatPage, quoteSnippet, toggleReaction,
} from '@/lib/community-chat-fields';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 5, 9, 0) + minutes * 60_000).toISOString();
const message = (id: string, userId: string, minutes: number, replyTo: unknown = null) => ({ id, userId, createdAt: at(minutes), replyTo });

describe('chat text', () => {
  it('keeps line breaks, drops trailing spaces and extra blank lines, and may be empty', () => {
    expect(parseChatText('  Привет \r\n\r\n\r\n\r\n\r\nкак дела  ')).toBe('Привет\n\n\nкак дела');
    expect(parseChatText(null)).toBe('');
    expect(() => parseChatText('я'.repeat(CHAT_TEXT_LIMIT + 1))).toThrow(ChatError);
    expect(parseChatText('я'.repeat(CHAT_TEXT_LIMIT))).toHaveLength(CHAT_TEXT_LIMIT);
  });

  it('quotes the start of a message on one line', () => {
    expect(quoteSnippet('Первая строка\nвторая')).toBe('Первая строка вторая');
    const long = quoteSnippet('слово '.repeat(40), 30);
    expect(long).toHaveLength(30);
    expect(long.endsWith('…')).toBe(true);
  });

  it('accepts only the reactions the database knows and message ids', () => {
    expect(CHAT_REACTIONS).toContain('🔥');
    expect(isChatReaction('🔥')).toBe(true);
    expect(isChatReaction('💩')).toBe(false);
    expect(isChatReaction(1)).toBe(false);
    expect(isChatId('7d8c1c43-36ce-4c0c-9a51-2a8b1d0f1f6c')).toBe(true);
    expect(isChatId('1; drop table')).toBe(false);
    // Every emoji of the picker is a single grapheme, so «insert at the caret» never splits one.
    for (const group of CHAT_EMOJI) for (const emoji of group.emoji) expect([...new Intl.Segmenter().segment(emoji)]).toHaveLength(1);
  });
});

describe('message groups', () => {
  it('keeps one author in one group until another author, a pause, a new day or a reply', () => {
    const groups = groupChatMessages([
      message('1', 'a', 0), message('2', 'a', 1), message('3', 'b', 2), message('4', 'b', 3, { id: '1' }),
      message('5', 'b', 4), message('6', 'b', 20), message('7', 'b', 15 * 60 + 30),
    ]);
    expect(groups.map(group => group.messages.map(item => item.id))).toEqual([['1', '2'], ['3'], ['4', '5'], ['6'], ['7']]);
    // 09:00 UTC is 12:00 in Moscow; 15.5 hours later it is past midnight there.
    expect(groups.map(group => group.newDay)).toEqual([true, false, false, false, true]);
  });
});

describe('polling', () => {
  const older = [message('a', 'u', 0), message('b', 'u', 1)];
  it('replaces everything from the newest page on: deleted messages leave, new ones arrive, older pages stay', () => {
    const held = [...older, message('c', 'u', 2), message('d', 'u', 3)];
    const page = [message('c', 'u', 2), message('e', 'u', 4)];
    expect(mergeChatPage(held, page, true)).toEqual({ items: [...older, page[0], page[1]], reset: false });
  });

  it('starts over when the page has nothing in common with what is held, and empties an emptied chat', () => {
    const page = [message('x', 'u', 50), message('y', 'u', 51)];
    expect(mergeChatPage(older, page, true)).toEqual({ items: page, reset: true });
    expect(mergeChatPage(older, [], false)).toEqual({ items: [], reset: true });
    expect(mergeChatPage([], page, false)).toEqual({ items: page, reset: false });
  });

  it('puts an older page in front without duplicates', () => {
    expect(prependChatPage([message('b', 'u', 1), message('c', 'u', 2)], older).map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('reactions', () => {
  it('turns the viewer’s reaction on and off before the server answers', () => {
    expect(toggleReaction([], '🔥')).toEqual([{ emoji: '🔥', count: 1, mine: true }]);
    expect(toggleReaction([{ emoji: '🔥', count: 2, mine: false }], '🔥')).toEqual([{ emoji: '🔥', count: 3, mine: true }]);
    expect(toggleReaction([{ emoji: '🔥', count: 3, mine: true }], '🔥')).toEqual([{ emoji: '🔥', count: 2, mine: false }]);
    expect(toggleReaction([{ emoji: '👍', count: 1, mine: true }, { emoji: '🔥', count: 1, mine: true }], '👍')).toEqual([{ emoji: '🔥', count: 1, mine: true }]);
  });
});

describe('days', () => {
  it('names today, yesterday and older dates in Moscow time', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(chatDayLabel('2026-11-05T08:00:00Z', now)).toBe('Сегодня');
    expect(chatDayLabel('2026-11-04T20:59:00Z', now)).toBe('Вчера');
    expect(chatDayLabel('2026-11-04T21:01:00Z', now)).toBe('Сегодня');
    expect(chatDayLabel('2026-10-01T10:00:00Z', now)).toBe('1 октября');
    expect(chatDayLabel('2025-10-01T10:00:00Z', now)).toMatch(/2025/);
  });
});

describe('the button', () => {
  it('is a round labelled button that opens the chat dialog', () => {
    const html = renderToStaticMarkup(createElement(CommunityChat, { signedIn: false }));
    expect(html).toContain('class="chat-fab motion-local"');
    expect(html).toContain('aria-label="Чат сообщества"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
  });
});
