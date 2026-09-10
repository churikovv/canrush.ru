import { describe, expect, it } from 'vitest';
import { normalizeAdminEmail, normalizeAdminSearch, validateAdminEmail } from '../src/lib/admin-fields.js';

describe('admin fields', () => {
  it('normalizes email used for access checks', () => {
    expect(normalizeAdminEmail('  Sobik.Steam@YANDEX.RU ')).toBe('sobik.steam@yandex.ru');
  });

  it('rejects invalid admin emails', () => {
    expect(validateAdminEmail('owner')).toBeNull();
    expect(validateAdminEmail('a @example.com')).toBeNull();
    expect(validateAdminEmail('admin@example.com')).toBe('admin@example.com');
  });

  it('caps moderation search input', () => {
    expect(normalizeAdminSearch(`  ${'a'.repeat(100)}  `)).toHaveLength(80);
  });
});
