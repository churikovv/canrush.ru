import { describe, expect, it } from 'vitest';
import { BusinessError, csvCell, parseBusinessInput, sortRows, percentChange, weekStart, weeklySeries } from '../src/lib/business-fields';

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
