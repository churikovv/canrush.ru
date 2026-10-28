import { describe, expect, it } from 'vitest';
import { renderBusinessApprovedEmail, renderBusinessWeeklyEmail, renderBusinessInviteEmail, renderMagicLinkEmail } from '../src/lib/email.js';

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

  it('writes the approval letter and escapes the company name', () => {
    const email = renderBusinessApprovedEmail('<b>Energy</b> Lab', 'https://canrush.ru/business/cabinet');
    expect(email.subject).toBe('Компания «<b>Energy</b> Lab» подтверждена — CanRush для бизнеса');
    expect(email.html).toContain('&lt;b&gt;Energy&lt;/b&gt; Lab');
    expect(email.html).not.toContain('<b>Energy');
    expect(email.text).toContain('https://canrush.ru/business/cabinet');
  });

  it('writes the weekly report with changes and escapes what members wrote', () => {
    const email = renderBusinessWeeklyEmail({
      business: 'Energy <Lab>', from: '2026-10-19', to: '2026-10-25',
      reviews: { now: 5, before: 2, score: 7.5 }, searches: { now: 3, before: 4, missed: 1 }, views: { now: 10, before: 10 }, clicks: { now: 2, before: 0 },
      latest: [{ drink: 'Burn · Манго', score: 8, text: '<img src=x>' }], rivals: [{ label: 'Burn', own: true, reviews: 5, views: 10 }, { label: 'Monster', own: false, reviews: 9, views: 30 }],
    }, 'https://canrush.ru/business/cabinet', 'https://canrush.ru/business/cabinet?section=settings&tab=notifications');
    expect(email.subject).toBe('Energy <Lab>: отчёт за неделю 19 октября — 25 октября — CanRush для бизнеса');
    expect(email.text).toContain('Отзывы: 5 (+3) · средняя 7,5');
    expect(email.text).toContain('Поиски с брендом: 3 (−1) · 1 без результатов');
    expect(email.text).toContain('Просмотры карточек: 10\n');
    expect(email.html).toContain('&lt;img src=x&gt;');
    expect(email.html).not.toContain('<img src=x>');
    expect(email.html).toContain('Energy &lt;Lab&gt;');
    expect(email.html).toContain('tab=notifications');
  });
});
