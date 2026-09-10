export type ProfileField = 'username' | 'name' | 'telegramChannel';

export interface ProfileInput {
  username: string;
  name: string;
  telegramChannel: string | null;
}

export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

export type ProfileValidationResult =
  | { data: ProfileInput; errors?: never }
  | { data?: never; errors: ProfileFieldErrors };

const RESERVED_USERNAMES = new Set(['api', 'auth', 'edit', 'favorites', 'tierlists', 'profile', 'sign-in', 'admin']);

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(value));
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLocaleLowerCase('en-US');
}

export function normalizeTelegramChannel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .replace(/\/$/, '');
}

export function validateProfileInput(values: {
  username: string;
  name: string;
  telegramChannel: string;
}): ProfileValidationResult {
  const username = normalizeUsername(values.username);
  const name = values.name.trim().replace(/\s+/gu, ' ');
  const telegramChannel = normalizeTelegramChannel(values.telegramChannel);
  const errors: ProfileFieldErrors = {};

  if (!/^[a-z0-9_]{3,24}$/u.test(username)) {
    errors.username = 'От 3 до 24 символов: латинские буквы, цифры и подчёркивание.';
  } else if (isReservedUsername(username)) {
    errors.username = 'Этот юзернейм зарезервирован.';
  }

  if (!name) {
    errors.name = 'Введите имя.';
  } else if (name.length > 40) {
    errors.name = 'Имя должно быть не длиннее 40 символов.';
  } else if (/[\u0000-\u001f\u007f]/u.test(name)) {
    errors.name = 'Имя содержит недопустимые символы.';
  }

  if (telegramChannel && !/^[a-z][a-z0-9_]{4,31}$/iu.test(telegramChannel)) {
    errors.telegramChannel = 'Укажите ссылку t.me или юзернейм канала длиной от 5 до 32 символов.';
  }

  return Object.keys(errors).length > 0
    ? { errors }
    : {
        data: {
          username,
          name,
          telegramChannel,
        },
      };
}
