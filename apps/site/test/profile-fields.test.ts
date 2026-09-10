import { describe, expect, it } from 'vitest';
import {
  normalizeTelegramChannel,
  normalizeUsername,
  validateProfileInput,
} from '../src/lib/profile-fields.js';

describe('profile fields', () => {
  it('нормализует юзернейм', () => {
    expect(normalizeUsername('  @SobiKon  ')).toBe('sobikon');
  });

  it('принимает ссылку и юзернейм Telegram', () => {
    expect(normalizeTelegramChannel('https://t.me/Energy_Hub/')).toBe('Energy_Hub');
    expect(normalizeTelegramChannel('@energyhub')).toBe('energyhub');
    expect(normalizeTelegramChannel('')).toBeNull();
  });

  it('валидирует и очищает данные профиля', () => {
    expect(
      validateProfileInput({
        username: '@sobikon',
        name: ' Vladimir   Churikov ',
        telegramChannel: 't.me/energyhub',
      }),
    ).toEqual({
      data: {
        username: 'sobikon',
        name: 'Vladimir Churikov',
        telegramChannel: 'energyhub',
      },
    });
  });

  it('отклоняет зарезервированный юзернейм и некорректный Telegram', () => {
    const result = validateProfileInput({
      username: 'edit',
      name: '',
      telegramChannel: 'not a channel',
    });

    expect(result.errors).toMatchObject({
      username: expect.any(String),
      name: expect.any(String),
      telegramChannel: expect.any(String),
    });
  });
});
