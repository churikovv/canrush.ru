import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  isTelegramPlaceholderEmail,
  telegramDisplayName,
  telegramLinkCode,
  telegramPlaceholderEmail,
  verifyTelegramInitData,
} from '../src/lib/telegram-init-data.js';

const BOT_TOKEN = '123456:test-token-for-canrush-mini-app-signature';
const NOW = Date.UTC(2026, 9, 15, 12);

function signInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

const USER = JSON.stringify({ id: 4242, first_name: 'Иван', last_name: 'Петров', username: 'IvanP' });
const fresh = { auth_date: String(NOW / 1_000 - 60), query_id: 'AAE', user: USER, signature: 'sig' };

describe('verifyTelegramInitData', () => {
  it('accepts correctly signed launch data', () => {
    const data = verifyTelegramInitData(signInitData({ ...fresh, start_param: 'link_x' }), BOT_TOKEN, NOW);
    expect(data).toEqual({
      user: { id: '4242', firstName: 'Иван', lastName: 'Петров', username: 'IvanP' },
      authDate: NOW / 1_000 - 60,
      startParam: 'link_x',
    });
  });

  it('rejects tampered fields and a foreign bot token', () => {
    const signed = signInitData(fresh);
    expect(verifyTelegramInitData(signed.replace('4242', '4243'), BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData(signInitData(fresh, '654321:another-token-for-canrush-tests-1234'), BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData(`${signed}&extra=1`, BOT_TOKEN, NOW)).toBeNull();
  });

  it('rejects stale, missing or malformed data', () => {
    expect(verifyTelegramInitData(signInitData({ ...fresh, auth_date: String(NOW / 1_000 - 2 * 86_400) }), BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData(signInitData({ auth_date: fresh.auth_date }), BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData(signInitData({ ...fresh, user: '{"id":"1","first_name":"x"}' }), BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData('', BOT_TOKEN, NOW)).toBeNull();
    expect(verifyTelegramInitData('hash=zz', BOT_TOKEN, NOW)).toBeNull();
  });
});

describe('Telegram account helpers', () => {
  it('builds an undeliverable unique email that seeds the username', () => {
    const email = telegramPlaceholderEmail({ id: '4242', firstName: 'Иван', username: 'IvanP' });
    expect(email).toBe('ivanp@4242.telegram.invalid');
    expect(isTelegramPlaceholderEmail(email)).toBe(true);
    expect(isTelegramPlaceholderEmail('ivan@example.com')).toBe(false);
    expect(telegramPlaceholderEmail({ id: '7', firstName: 'A' })).toBe('user@7.telegram.invalid');
  });

  it('names the account and extracts only well-formed link codes', () => {
    expect(telegramDisplayName({ id: '1', firstName: ' ', username: 'nick' })).toBe('@nick');
    const code = 'a'.repeat(32);
    expect(telegramLinkCode(`link_${code}`)).toBe(code);
    expect(telegramLinkCode('link_short')).toBeNull();
    expect(telegramLinkCode(undefined)).toBeNull();
  });
});
