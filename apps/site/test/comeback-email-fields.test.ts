import { describe, expect, it } from 'vitest';
import { comebackPreheader, comebackSubject, hasNews, isUnsubscribeToken, plural, unsubscribeToken, type ComebackDigest } from '../src/lib/comeback-email-fields';
import { renderComebackEmail } from '../src/lib/email';

const SECRET = 'comeback-test-secret-of-at-least-32-bytes';
const empty: ComebackDigest = { username: null, events: [], unread: 0, newDrinks: { total: 0, items: [] }, popular: [], articles: [] };
const drink = (name: string) => ({ brand: 'Burn', name, href: `https://canrush.ru/catalog/burn-${name}`, cover: 'https://canrush.ru/images/products/burn.jpg' });

describe('comeback letter rules', () => {
  it('signs the unsubscribe link for one member only', () => {
    const token = unsubscribeToken('user-1', SECRET);
    expect(isUnsubscribeToken('user-1', token, SECRET)).toBe(true);
    expect(isUnsubscribeToken('user-2', token, SECRET)).toBe(false);
    expect(isUnsubscribeToken('user-1', token, `${SECRET}-other`)).toBe(false);
    expect(isUnsubscribeToken('user-1', `${token.slice(0, -1)}A`, SECRET)).toBe(token.endsWith('A'));
    expect(isUnsubscribeToken('user-1', undefined, SECRET)).toBe(false);
    expect(isUnsubscribeToken('user-1', 'x'.repeat(200), SECRET)).toBe(false);
  });

  it('sends only with news: the week’s popular drinks alone are the same for everyone', () => {
    expect(hasNews(empty)).toBe(false);
    expect(hasNews({ ...empty, popular: [drink('mango')] })).toBe(false);
    expect(hasNews({ ...empty, unread: 1 })).toBe(true);
    expect(hasNews({ ...empty, newDrinks: { total: 3, items: [drink('mango')] } })).toBe(true);
    expect(hasNews({ ...empty, articles: [{ title: 'Статья', summary: '', href: 'https://canrush.ru/news/1', minutes: 2 }] })).toBe(true);
  });

  it('names the subject after the most visible section', () => {
    const award = { key: 'award', title: 'Премия за энергию 2026', text: '', button: 'Голосовать', href: 'https://canrush.ru/awards', image: null };
    expect(comebackSubject({ ...empty, events: [award], unread: 3 })).toBe('Премия за энергию 2026: выберите энергетики года — CanRush');
    expect(comebackSubject({ ...empty, unread: 1 })).toBe('1 новое уведомление на CanRush');
    expect(comebackSubject({ ...empty, unread: 12 })).toBe('12 новых уведомлений на CanRush');
    expect(comebackSubject({ ...empty, newDrinks: { total: 3, items: [] } })).toBe('3 новых энергетика в каталоге CanRush');
    expect(comebackSubject(empty)).toBe('Что нового на CanRush');
    expect(comebackPreheader({ ...empty, unread: 2, popular: [drink('mango')] })).toBe('2 уведомления · что обсуждают на неделе');
    expect([1, 2, 5, 11, 21, 104].map(count => plural(count, 'отзыв', 'отзыва', 'отзывов'))).toEqual(['отзыв', 'отзыва', 'отзывов', 'отзывов', 'отзыв', 'отзыва']);
  });

  it('renders the sections, escapes what members wrote and explains how to unsubscribe', () => {
    const unsubscribe = 'https://canrush.ru/unsubscribe?u=user-1&t=abc';
    const email = renderComebackEmail({
      ...empty, username: 'nick<b>',
      events: [{ key: 'award', title: 'Премия за энергию 2026', text: 'Голосование до 27 декабря.', button: 'Голосовать', href: 'https://canrush.ru/awards', image: 'https://canrush.ru/brand/mail/trophy.png' }],
      unread: 4,
      newDrinks: { total: 6, items: [drink('mango'), { ...drink('<script>'), cover: null }] },
      popular: [{ ...drink('cherry'), note: '★ 8,4 · 5 отзывов за неделю' }],
      articles: [{ title: 'Как мы <выбирали>', summary: 'Коротко & ясно', href: 'https://canrush.ru/news/1', minutes: 3 }],
    }, 'https://canrush.ru', unsubscribe);
    expect(email.subject).toBe('Премия за энергию 2026: выберите энергетики года — CanRush');
    expect(email.html).toContain('Привет, @nick&lt;b&gt;!');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('Как мы &lt;выбирали&gt;');
    expect(email.html).toContain('Коротко &amp; ясно');
    expect(email.html).toContain('У вас 4 непрочитанных уведомления');
    expect(email.html).toContain('https://canrush.ru/?notifications=open');
    expect(email.html).toContain('Всего новых: 6');
    expect(email.html).toContain('https://canrush.ru/brand/mail/logo.png');
    expect(email.html).toContain('https://canrush.ru/unsubscribe?u=user-1&amp;t=abc');
    expect(email.html).toContain('не чаще раза в две недели');
    expect(email.text).toContain(`Отписаться: ${unsubscribe}`);
    expect(email.text).toContain('Голосовать: https://canrush.ru/awards');
    // No tracking pixels: only the logo, the trophy and drink covers.
    expect([...email.html.matchAll(/<img src="([^"]+)"/g)].map(match => match[1])).toEqual([
      'https://canrush.ru/brand/mail/logo.png', 'https://canrush.ru/brand/mail/trophy.png', 'https://canrush.ru/images/products/burn.jpg', 'https://canrush.ru/images/products/burn.jpg',
    ]);
  });
});
