import { describe, expect, it } from 'vitest';
import { brandSearchNames, normalizeSearchQuery } from '../src/lib/search-log-fields';
import { BusinessError, csvCell, fillReplyTemplate, parseReplyTemplate, replyTemplateTitle, parseBusinessInput, parseBusinessReply, MAX_BUSINESS_REPLY, sortRows, percentChange, weekStart, weeklySeries } from '../src/lib/business-fields';

const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

describe('parseBusinessInput', () => {
  it('normalises the site and the Telegram link', () => {
    expect(parseBusinessInput(form({ name: '  Energy   Lab ', kind: 'brand', website: 'energylab.ru/', telegram: 'https://t.me/energy_lab', contactEmail: '', about: '' })))
      .toEqual({ name: 'Energy Lab', kind: 'brand', website: 'https://energylab.ru', telegram: 'energy_lab', contactEmail: null, about: null });
  });
  it('refuses an unknown kind, a short name and a bad email', () => {
    expect(() => parseBusinessInput(form({ name: 'Energy', kind: 'bank' }))).toThrow(BusinessError);
    expect(() => parseBusinessInput(form({ name: 'E', kind: 'shop' }))).toThrow('от 2 до 80');
    expect(() => parseBusinessInput(form({ name: 'Energy', kind: 'shop', contactEmail: 'nope' }))).toThrow('Почта');
  });
});

describe('weekly numbers', () => {
  it('buckets weeks from Monday and fills the gaps', () => {
    expect(weekStart('2026-10-27')).toBe('2026-10-26');
    expect(weeklySeries([{ week: '2026-10-19', count: 3 }], '2026-10-27', 3)).toEqual([
      { week: '2026-10-12', count: 0 }, { week: '2026-10-19', count: 3 }, { week: '2026-10-26', count: 0 },
    ]);
  });
  it('gives the change in percent, none without a previous period', () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(3, 0)).toBeNull();
  });
});

describe('csvCell', () => {
  it('quotes separators and stops formulas', () => {
    expect(csvCell('Сочный')).toBe('Сочный');
    expect(csvCell('вкус; "топ"')).toBe('"вкус; ""топ"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe('sortRows', () => {
  const rows = [{ name: 'Б', score: 7 }, { name: 'А', score: null }, { name: 'В', score: 9 }];
  const columns = { name: (row: typeof rows[number]) => row.name, score: (row: typeof rows[number]) => row.score };
  it('sorts both ways, empty values last', () => {
    expect(sortRows(rows, 'score', 'desc', columns).map(row => row.name)).toEqual(['В', 'Б', 'А']);
    expect(sortRows(rows, 'score', 'asc', columns).map(row => row.name)).toEqual(['Б', 'В', 'А']);
    expect(sortRows(rows, 'name', 'asc', columns).map(row => row.name)).toEqual(['А', 'Б', 'В']);
  });
  it('keeps the order for an unknown column', () => expect(sortRows(rows, 'nope', 'asc', columns)).toBe(rows));
});

describe('company replies and the search log', () => {
  it('keeps line breaks, collapses spaces and checks the length of a reply', () => {
    expect(parseBusinessReply('  Спасибо!   Учтём.\r\n\n\n\nДо встречи  ')).toBe('Спасибо! Учтём.\n\nДо встречи');
    expect(() => parseBusinessReply('   ')).toThrow(BusinessError);
    expect(() => parseBusinessReply('а'.repeat(MAX_BUSINESS_REPLY + 1))).toThrow('символов');
  });
  it('normalises queries and brand names the same way', () => {
    expect(normalizeSearchQuery('  Burn   МАНГО  Ёлка ')).toBe('burn манго елка');
    expect(brandSearchNames('100 Kwt')).toEqual(['100 kwt', '100 квт', 'сто киловатт', 'киловатт']);
  });
});

describe('reply templates', () => {
  it('fills the placeholders for one review', () => {
    expect(fillReplyTemplate('{Автор}, спасибо! Рады, что {напиток} понравился, {автор}.', { author: 'Анна', drink: 'Burn · Манго' }))
      .toBe('Анна, спасибо! Рады, что Burn · Манго понравился, Анна.');
  });
  it('checks the title and keeps the reply rules for the text', () => {
    expect(parseReplyTemplate('  Спасибо   за отзыв ', ' Спасибо!\n\n\n\nЖдём ещё. ')).toEqual({ title: 'Спасибо за отзыв', text: 'Спасибо!\n\nЖдём ещё.' });
    expect(() => parseReplyTemplate(' ', 'Текст')).toThrow('Назовите');
    expect(() => parseReplyTemplate('a'.repeat(41), 'Текст')).toThrow('до 40');
    expect(() => parseReplyTemplate('Пусто', '  ')).toThrow('Напишите ответ');
  });
  it('suggests a title from the first words', () => {
    expect(replyTemplateTitle('Спасибо!')).toBe('Спасибо!');
    expect(replyTemplateTitle('Спасибо за подробный отзыв, мы обязательно передадим технологам')).toBe('Спасибо за подробный отзыв,…');
  });
});

describe('plans', async () => {
  const plans = await import('../src/lib/business-plans');
  const { historyWindow, monthlySeries } = await import('../src/lib/business-fields');
  it('falls back to «Старт» when a paid plan ran out', () => {
    expect(plans.effectivePlan({ plan: 'brand', planUntil: new Date(Date.now() + 86_400_000) })).toBe('brand');
    expect(plans.effectivePlan({ plan: 'network', planUntil: new Date(Date.now() - 1000) })).toBe('start');
    expect(plans.hasFeature({ plan: 'start' }, 'competitors')).toBe(false);
    expect(plans.planFor('search').key).toBe('brand');
  });
  it('keeps the analytics window within the plan', () => {
    expect(historyWindow('365', 365)).toBe(365);
    expect(historyWindow('365', 90)).toBe(30);
    expect(historyWindow('45', 365)).toBe(30);
    expect(monthlySeries([{ week: '2026-10-01', count: 4 }], '2026-10-28').slice(-2)).toEqual([{ week: '2026-09-01', count: 0 }, { week: '2026-10-01', count: 4 }]);
  });
  it('reads the invoice request and prices it, founders included', () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ plan: 'network', period: 'year', payer: ' ИП  Иванов ', inn: '7700-0000-0000', email: 'Pay@Example.com' })) form.set(key, value);
    expect(plans.parsePlanRequest(form)).toEqual({ plan: 'network', period: 'year', payer: 'ИП Иванов', inn: '770000000000', email: 'pay@example.com', comment: null });
    form.set('inn', '123'); expect(() => plans.parsePlanRequest(form)).toThrow('ИНН');
    expect(plans.planPrice('brand', 'month', true)).toBe(plans.FOUNDER_MONTHLY);
    expect(plans.planPrice('network', 'year')).toBe(149000);
  });
});
