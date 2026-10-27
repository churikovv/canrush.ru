import { describe, expect, it } from 'vitest';
import { digestPrompt, parseDigest } from '../src/lib/review-digest-fields';

describe('review digest', () => {
  it('sends only scores and texts, numbered', () => {
    const [system, user] = digestPrompt('Burn · Манго', [{ taste: 8, design: 6, text: 'Сочный,\n  не приторный' }]);
    expect(system!.content).toContain('строго одним JSON');
    expect(user!.content).toBe('Напиток: Burn · Манго\nОтзывы (1):\n1. Вкус 8/10, дизайн 6/10: Сочный, не приторный');
  });
  it('reads a fenced JSON answer and trims the lists', () => {
    const digest = parseDigest('```json\n{"summary":" Хвалят вкус. ","sentiment":"positive","praise":["вкус","","газ","банка","цена","лишнее"],"complaints":[],"suggestions":"не список"}\n```');
    expect(digest).toEqual({ summary: 'Хвалят вкус.', sentiment: 'positive', praise: ['вкус', 'газ', 'банка', 'цена'], complaints: [], suggestions: [] });
  });
  it('treats an unknown sentiment as mixed and rejects answers without a summary', () => {
    expect(parseDigest('{"summary":"ок","sentiment":"great"}')?.sentiment).toBe('mixed');
    expect(parseDigest('{"praise":["вкус"]}')).toBeNull();
    expect(parseDigest('Извините, не могу')).toBeNull();
  });
});
