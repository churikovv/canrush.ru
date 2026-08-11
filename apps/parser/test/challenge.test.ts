import { describe, expect, it } from 'vitest';
import { classifyChallenge } from '../src/browser/challenge.js';

describe('classifyChallenge', () => {
  it('распознаёт временный челлендж по статусу 429/498/401', () => {
    expect(classifyChallenge('', 429)).toBe('challenge');
    expect(classifyChallenge('', 498)).toBe('challenge');
    expect(classifyChallenge('', 401)).toBe('challenge');
  });

  it('распознаёт жёсткую блокировку по статусу 403', () => {
    expect(classifyChallenge('', 403)).toBe('blocked');
  });

  it('распознаёт челлендж по тексту страницы (WB/5ka)', () => {
    expect(classifyChallenge('Проверяем браузер...')).toBe('challenge');
    expect(classifyChallenge('Пожалуйста, подтвердите, что вы не робот')).toBe('challenge');
  });

  it('распознаёт блокировку по тексту страницы (Lenta/Ozon)', () => {
    expect(classifyChallenge('403 Error Forbidden. Доступ к сайту lenta.com запрещен')).toBe('blocked');
    expect(classifyChallenge('Похоже, нет соединения')).toBe('blocked');
  });

  it('возвращает clear для обычной страницы без маркеров', () => {
    expect(classifyChallenge('Каталог энергетических напитков — 42 товара')).toBe('clear');
  });

  it('статус имеет приоритет над текстом', () => {
    expect(classifyChallenge('Обычная страница без маркеров', 403)).toBe('blocked');
  });
});
