import { describe, expect, it } from 'vitest';
import { renderBusinessInviteEmail, renderMagicLinkEmail } from '../src/lib/email.js';

describe('magic link email', () => {
  it('renders equivalent HTML and plain text without remote tracking content', () => {
    const link = 'https://canrush.ru/auth/confirm?token=AbCd&next=/profile';
    const email = renderMagicLinkEmail(link);

    expect(email.subject).toBe('Вход в CanRush');
    expect(email.text).toContain(link);
    expect(email.text).toContain('15 минут');
    expect(email.html).toContain('token=AbCd&amp;next=/profile');
    expect(email.html).not.toMatch(/<img|tracking|pixel/i);
  });

  it('writes the business letter about the cabinet', () => {
    const email = renderMagicLinkEmail('https://canrush.ru/auth/confirm?token=AbCd&for=business', 'business');
    expect(email.subject).toBe('Вход в кабинет CanRush для бизнеса');
    expect(email.html).toContain('Открыть кабинет');
    expect(email.text).toContain('for=business');
  });

  it('escapes values placed into the HTML link', () => {
    const email = renderMagicLinkEmail('https://canrush.ru/?value=\"><script>alert(1)</script>');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('writes the team invitation and escapes the company name', () => {
    const email = renderBusinessInviteEmail('<b>Energy</b> Lab', 'Анна', 'https://canrush.ru/sign-in?for=business');
    expect(email.subject).toBe('Приглашение в команду «<b>Energy</b> Lab» — CanRush для бизнеса');
    expect(email.html).toContain('&lt;b&gt;Energy&lt;/b&gt; Lab');
    expect(email.html).not.toContain('<b>Energy');
    expect(email.text).toContain('Анна приглашает вас');
  });
});
