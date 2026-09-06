import { describe, expect, it } from 'vitest';
import { emailRateLimitKey, normalizeEmailForRateLimit } from '../src/lib/email-rate-limit.js';

describe('email rate-limit identifiers', () => {
  it('normalizes equivalent email input', () => {
    expect(normalizeEmailForRateLimit('  USER@Example.COM  ')).toBe('user@example.com');
  });

  it('uses a stable keyed hash without exposing the email', () => {
    const first = emailRateLimitKey('USER@example.com', 'a'.repeat(32));
    const second = emailRateLimitKey(' user@EXAMPLE.com ', 'a'.repeat(32));
    const rotated = emailRateLimitKey('user@example.com', 'b'.repeat(32));

    expect(first).toBe(second);
    expect(first).not.toContain('user@example.com');
    expect(rotated).not.toBe(first);
  });
});
