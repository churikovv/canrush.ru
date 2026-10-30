import { describe, expect, it } from 'vitest';
import { fileSizeLabel, isPdf, parseAwardInput, parseCompanyInfo, parseHiddenSections, parsePostText, pdfFileName, telHref } from '../src/lib/business-profile-fields';

describe('company profile rules', () => {
  it('shows every section unless switched off', () => {
    const form = new FormData();
    form.set('show-store', 'on'); form.set('show-drinks', 'on');
    expect(parseHiddenSections(form)).toEqual(['presentations', 'listings', 'awards']);
  });

  it('tells a PDF by its content and keeps a clean file name', () => {
    expect(isPdf(new TextEncoder().encode('%PDF-1.7\n…'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>%PDF-'))).toBe(false);
    expect(pdfFileName('C:\\decks\\Презентация "2026".PDF')).toBe('Презентация 2026.pdf');
    expect(pdfFileName('../../etc/passwd')).toBe('passwd.pdf');
    expect(pdfFileName('')).toBe('Презентация.pdf');
  });

  it('trims post text and limits it', () => {
    expect(parsePostText('  Новинка\r\n\r\n\r\nуже в продаже ')).toBe('Новинка\n\nуже в продаже');
    expect(() => parsePostText('x'.repeat(1001))).toThrow('1000');
    expect(fileSizeLabel(2.4 * 1024 * 1024)).toBe('2,4 МБ');
    expect(fileSizeLabel(800)).toBe('1 КБ');
  });

  it('reads the profile texts and contacts, empty as null', () => {
    const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
    expect(parseCompanyInfo(form({ bio: '  Энергия.\n Люди. ', story: 'Абзац 1\r\n\r\n\r\nАбзац 2', publicEmail: 'hello@brand.ru', phone: '+7 (495) 123-45-67', address: '' })))
      .toEqual({ bio: 'Энергия. Люди.', story: 'Абзац 1\n\nАбзац 2', publicEmail: 'hello@brand.ru', phone: '+7 (495) 123-45-67', address: null });
    expect(parseCompanyInfo(form({}))).toEqual({ bio: null, story: null, publicEmail: null, phone: null, address: null });
    expect(() => parseCompanyInfo(form({ bio: 'x'.repeat(161) }))).toThrow('160');
    expect(() => parseCompanyInfo(form({ publicEmail: 'нет' }))).toThrow('Почта');
    expect(() => parseCompanyInfo(form({ phone: 'javascript:alert(1)' }))).toThrow('Телефон');
    expect(telHref('+7 (495) 123-45-67')).toBe('tel:+74951234567');
  });
});

describe('parseAwardInput', () => {
  const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };
  const now = new Date('2026-10-30T12:00:00Z');
  it('cleans the fields and keeps the optional ones empty', () => {
    expect(parseAwardInput(form({ title: '  Лучший   продукт ', issuer: ' ', year: '' }), now)).toEqual({ title: 'Лучший продукт', issuer: null, year: null });
    expect(parseAwardInput(form({ title: 'Диплом', issuer: 'Продэкспо', year: '2026' }), now)).toEqual({ title: 'Диплом', issuer: 'Продэкспо', year: 2026 });
  });
  it.each([
    [{ title: '' }, 'название'], [{ title: 'я'.repeat(121) }, 'до 120'], [{ title: 'Д', issuer: 'я'.repeat(121) }, 'до 120'],
    [{ title: 'Д', year: '1899' }, 'Год'], [{ title: 'Д', year: '2028' }, 'Год'], [{ title: 'Д', year: 'год' }, 'Год'],
  ])('refuses %j', (fields, message) => { expect(() => parseAwardInput(form(fields), now)).toThrow(message); });
});
