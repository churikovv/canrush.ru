import { describe, expect, it } from 'vitest';
import { renderMagicLinkEmail } from '../src/lib/email.js';

describe('magic link email', () => {
  it('renders equivalent HTML and plain text without remote tracking content', () => {
    const link = 'https://canrush.ru/auth/confirm?token=AbCd&next=/profile';
    const email = renderMagicLinkEmail(link);

    expect(email.subject).toBe('Вход в CanRush');
    expect(email.text).toContain(link);
    expect(email.text).toContain('5 минут');
    expect(email.html).toContain('token=AbCd&amp;next=/profile');
    expect(email.html).not.toMatch(/<img|tracking|pixel/i);
  });

  it('escapes values placed into the HTML link', () => {
    const email = renderMagicLinkEmail('https://canrush.ru/?value=\"><script>alert(1)</script>');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});
