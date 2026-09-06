import { describe, expect, it } from 'vitest';
import {
  buildMagicLinkConfirmationUrl,
  buildMagicLinkVerificationPath,
  isMagicLinkToken,
} from '../src/lib/magic-link-url.js';

const token = 'Ab'.repeat(16);

describe('magic link URL helpers', () => {
  it('builds the confirmation link from the configured origin', () => {
    expect(buildMagicLinkConfirmationUrl('https://canrush.ru', token)).toBe(
      `https://canrush.ru/auth/confirm?token=${token}`,
    );
  });

  it('uses only fixed same-origin verification callbacks', () => {
    const url = new URL(buildMagicLinkVerificationPath(token), 'https://canrush.ru');
    expect(url.pathname).toBe('/api/auth/magic-link/verify');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      token,
      callbackURL: '/profile',
      newUserCallbackURL: '/profile',
      errorCallbackURL: '/auth/error',
    });
  });

  it('rejects malformed or oversized tokens', () => {
    expect(isMagicLinkToken(token)).toBe(true);
    expect(isMagicLinkToken(`${token}x`)).toBe(false);
    expect(isMagicLinkToken('../profile')).toBe(false);
    expect(() => buildMagicLinkConfirmationUrl('https://canrush.ru', '../profile')).toThrow();
  });
});
