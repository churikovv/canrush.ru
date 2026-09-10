import { describe, expect, it } from 'vitest';
import { resolveRetailerDomain, retailerSlug } from '../src/retailer-icons.js';

describe('resolveRetailerDomain', () => {
  it('знает домены известных сетей', () => {
    expect(resolveRetailerDomain('Пятёрочка')).toBe('pyaterochka.ru');
    expect(resolveRetailerDomain('Магнит')).toBe('magnit.ru');
    expect(resolveRetailerDomain('Лента')).toBe('lenta.com');
    expect(resolveRetailerDomain('Перекрёсток')).toBe('perekrestok.ru');
    expect(resolveRetailerDomain('Дикси')).toBe('dixy.ru');
    expect(resolveRetailerDomain('Бристоль')).toBe('bristol.ru');
    expect(resolveRetailerDomain('Metro')).toBe('metro-cc.ru');
    expect(resolveRetailerDomain('Ашан')).toBe('auchan.ru');
  });

  it('игнорирует регистр и заменяет ё→е', () => {
    expect(resolveRetailerDomain('ПЯТЁРОЧКА')).toBe('pyaterochka.ru');
    expect(resolveRetailerDomain('МАГНИТ')).toBe('magnit.ru');
  });

  it('находит домен по частичному совпадению', () => {
    expect(resolveRetailerDomain('Магнит у дома')).toBe('magnit.ru');
    expect(resolveRetailerDomain('Магнит Косметик')).toBe('magnit.ru');
    expect(resolveRetailerDomain("O'KEY")).toBe('okey.ru');
    expect(resolveRetailerDomain('Окей')).toBe('okey.ru');
  });

  it('возвращает undefined для неизвестных сетей', () => {
    expect(resolveRetailerDomain('Неизвестный магазин')).toBeUndefined();
    expect(resolveRetailerDomain('')).toBeUndefined();
  });
});

describe('retailerSlug', () => {
  it('превращает имя сети в slug', () => {
    expect(retailerSlug('Бристоль')).toBe('бристоль');
    expect(retailerSlug('Metro')).toBe('metro');
    expect(retailerSlug('Ашан')).toBe('ашан');
  });

  it('заменяет пробелы и спецсимволы на дефис', () => {
    expect(retailerSlug("O'KEY")).toBe('o-key');
    expect(retailerSlug('Магнит у дома')).toBe('магнит-у-дома');
  });

  it('заменяет ё на е', () => {
    expect(retailerSlug('Пятёрочка')).toBe('пятерочка');
    expect(retailerSlug('Перекрёсток')).toBe('перекресток');
  });

  it('возвращает unknown для пустой строки', () => {
    expect(retailerSlug('')).toBe('unknown');
    expect(retailerSlug('!!!')).toBe('unknown');
  });
});
