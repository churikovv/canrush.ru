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
        telegramUsername: 'https://t.me/Sobikon',
      }),
    ).toEqual({
      data: {
        username: 'sobikon',
        name: 'Vladimir Churikov',
        telegramChannel: 'energyhub',
        telegramUsername: 'Sobikon',
      },
    });
  });

  it('отклоняет зарезервированный юзернейм и некорректный Telegram', () => {
    const result = validateProfileInput({
      username: 'edit',
      name: '',
      telegramChannel: 'not a channel',
      telegramUsername: '@1abc',
    });

    expect(result.errors).toMatchObject({
      username: expect.any(String),
      name: expect.any(String),
      telegramChannel: expect.any(String),
      telegramUsername: expect.any(String),
    });
  });

  it('личный Telegram необязателен', () => {
    expect(validateProfileInput({ username: 'sobikon', name: 'V', telegramChannel: '' }).data?.telegramUsername).toBeNull();
  });

  it('описание: одна строка до 160 символов, пустое — null, без поля — не меняется', () => {
    const base = { username: 'sobikon', name: 'V', telegramChannel: '' };
    expect(validateProfileInput({ ...base, bio: '  Пью   Burn\nпо утрам ' }).data?.bio).toBe('Пью Burn по утрам');
    expect(validateProfileInput({ ...base, bio: '   ' }).data?.bio).toBeNull();
    expect(validateProfileInput(base).data && 'bio' in validateProfileInput(base).data!).toBe(false);
    expect(validateProfileInput({ ...base, bio: 'a'.repeat(161) }).errors?.bio).toBeTruthy();
  });
});
