import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Notifications name someone by nick, and a nick has no known gender: a past verb after it («ответил», «подписался»)
 * would guess one. The words go to the bell, Telegram and push from one place (`describeNotification`), so the guard
 * reads that file.
 */
describe('notification copy', () => {
  const source = readFileSync(new URL('../src/lib/notifications.ts', import.meta.url), 'utf8');
  it('never puts a past-tense verb right after the actor', () => {
    const past = [...source.matchAll(/\$\{actor\} ([а-яё]+)/g)].map(match => match[1]!).filter(word => /(?:ил|ал|ял|ел|ёл|ыл|ул)(?:ся)?$/.test(word));
    expect(past).toEqual([]);
  });
  it('keeps every actor-led title in the present tense or without a verb', () => {
    const titles = [...source.matchAll(/title = [^;]*`\$\{actor\} ([^`]+)`/g)].map(match => match[1]!);
    expect(titles.length).toBeGreaterThan(5);
    for (const title of titles) expect(title).not.toMatch(/^[а-яё]+(?:ил|ал|ял|ел|ёл|ыл|ул)(?:ся)? /);
  });
});
