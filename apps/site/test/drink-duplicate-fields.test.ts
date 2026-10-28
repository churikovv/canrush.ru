import { describe, expect, it } from 'vitest';
import { combineDuplicateResults, duplicatePrompt, isConfidentDuplicate, mergeDuplicateVotes, parseDuplicateAnswer, shortlistCandidates, type DuplicateCandidate } from '../src/lib/drink-duplicate-fields';

const card = (flavor: string, fullName?: string, brand = 'Tornado'): DuplicateCandidate => ({ brand, flavor, ...(fullName ? { fullName } : {}), kind: 'shop' });

describe('drink duplicate check rules', () => {
  it('keeps the same brand only, without the drink itself, and shortlists by shared words', () => {
    const many = [...Array.from({ length: 20 }, (_, index) => card(`flavor${index}`)), card('tornado_lemoncake', 'Tornado Energy Lemoncake'), card('apple', '', 'Burn')];
    const drink = { brand: 'Tornado', flavor: 'Лимонный пирог', fullName: 'Tornado energy lemoncake' };
    const list = shortlistCandidates(drink, many, 5);
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ flavor: 'tornado_lemoncake' });
    expect(list.every(item => item.brand === 'Tornado')).toBe(true);
    expect(shortlistCandidates({ brand: 'tornado', flavor: 'apple' }, [card('apple'), card('mango')], 5).map(item => item.flavor)).toEqual(['apple', 'mango']);
    expect(shortlistCandidates({ brand: 'Tornado', flavor: 'apple' }, [card('apple'), card('mango')], 5).map(item => item.flavor)).toEqual(['mango']);
  });

  it('numbers the cards in the prompt and adds the label text', () => {
    const prompt = duplicatePrompt({ brand: 'Tornado', flavor: 'mango', ingredients: 'Вода, таурин' }, [card('apple'), card('mango', 'Tornado Max')]);
    expect(prompt).toContain('1. Tornado · ');
    expect(prompt).toContain('2. Tornado · ');
    expect(prompt).toContain('Состав с этикетки: Вода, таурин');
  });

  it('reads verdicts, refuses canned or broken answers and keeps sugar versions apart', () => {
    const list = [card('tornado_lemoncake'), card('mango:sugarfree')];
    const drink = { brand: 'Tornado', flavor: 'Лимонный пирог' };
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":1,"reason":"тот же вкус"}', list, drink)).toEqual({ verdict: 'duplicate', match: list[0], reason: 'тот же вкус' });
    expect(parseDuplicateAnswer('Ответ: {"verdict":"new","match":null,"reason":"другой"}', list, drink)).toMatchObject({ verdict: 'new', match: null });
    expect(parseDuplicateAnswer('Генеративные языковые модели не обладают собственным мнением', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":7}', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":null}', list, drink)).toBeNull();
    expect(parseDuplicateAnswer('{"verdict":"maybe"}', list, drink)).toBeNull();
    // A zero-sugar card is a drink of its own: the model's «duplicate» becomes «unsure».
    expect(parseDuplicateAnswer('{"verdict":"duplicate","match":"2","reason":"манго"}', list, { brand: 'Tornado', flavor: 'mango' }))
      .toMatchObject({ verdict: 'unsure', match: list[1], reason: expect.stringContaining('сахара') });
  });

  it('combines halves of a refused list: a duplicate wins, a refused half makes «new» untrustworthy', () => {
    const dup = { verdict: 'duplicate' as const, match: card('apple'), reason: '' };
    const fresh = { verdict: 'new' as const, match: null, reason: '' };
    expect(combineDuplicateResults([null, dup])).toBe(dup);
    expect(combineDuplicateResults([fresh, fresh])).toBe(fresh);
    expect(combineDuplicateResults([fresh, null])).toMatchObject({ verdict: 'failed' });
    expect(combineDuplicateResults([null, null])).toMatchObject({ verdict: 'failed' });
  });

  it('merges two answers: agreement makes a duplicate, a split vote only «unsure»', () => {
    const apple = card('apple');
    const dup = { verdict: 'duplicate' as const, match: apple, reason: 'тот же' };
    const fresh = { verdict: 'new' as const, match: null, reason: 'другой' };
    expect(mergeDuplicateVotes([dup, dup])).toEqual(dup);
    expect(mergeDuplicateVotes([fresh, dup])).toEqual({ ...dup, verdict: 'unsure' });
    expect(mergeDuplicateVotes([dup, { ...dup, match: card('mango') }])).toMatchObject({ verdict: 'unsure', match: apple });
    expect(mergeDuplicateVotes([fresh, fresh])).toEqual(fresh);
    expect(mergeDuplicateVotes([dup])).toEqual(dup);
  });

  it('is sure only when three answers name the same card', () => {
    const apple = card('apple'), mango = card('mango');
    const dup = (match: DuplicateCandidate) => ({ verdict: 'duplicate' as const, match, reason: '' });
    expect(isConfidentDuplicate([dup(apple), dup(apple), dup(apple)])).toBe(true);
    expect(isConfidentDuplicate([dup(apple), dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), dup(mango), dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), { verdict: 'unsure', match: apple, reason: '' }, dup(apple)])).toBe(false);
    expect(isConfidentDuplicate([dup(apple), null, dup(apple)])).toBe(false);
  });
});
